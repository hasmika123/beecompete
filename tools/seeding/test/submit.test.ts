import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import type { Config } from '../src/config.ts';
import { scoreConfidence } from '../src/confidence.ts';
import { normalize } from '../src/extract.ts';
import { submitToImportQueue } from '../src/submit.ts';
import type { ImportSubmission } from '../src/types.ts';

const fixtureUrl = new URL('../fixtures/sample-competition.expected.json', import.meta.url);

/**
 * The exact field set of apps/api `CompetitionRequest` — the shape an import-record payload must
 * deserialize into on approve (`ObjectMapper.convertValue(payload, CompetitionRequest.class)`).
 * If a field is added/renamed server-side, update this list AND src/types.ts together.
 */
const COMPETITION_REQUEST_FIELDS = new Set([
  'slug',
  'name',
  'organizerOrgId',
  // organizerName is emitted by the pipeline (resolve-or-create by name). confirmNewOrganizer is a
  // CompetitionRequest field too but the pipeline never emits it (curator-only override).
  'organizerName',
  'confirmNewOrganizer',
  'officialUrl',
  'logo',
  'description',
  'categoryId',
  'tags',
  'participationMode',
  'teamSizeMin',
  'teamSizeMax',
  'delivery',
  'entryPathway',
  'evaluationType',
  'minGrade',
  'maxGrade',
  'minAge',
  'maxAge',
  'costType',
  'recurrence',
  'attributes',
]);

/**
 * The two seeding EXTRAS the payload carries beyond CompetitionRequest (S3 v1). The approve path
 * splits these back out before mapping the competition half, so they are contract too — if the
 * server ever renames them, this test is the tripwire.
 */
const SEED_PAYLOAD_EXTRAS = new Set(['edition', 'keyDates']);

/** apps/api `EditionRequest` — the fields the pipeline may emit (advancesToEditionId is curator-only). */
const EDITION_REQUEST_FIELDS = new Set([
  'cycleLabel',
  'status',
  'scopeLevel',
  'registrationUrl',
  'entryFee',
  'currency',
  'ageCutoffDate',
  'prizeSummary',
  'prizeValue',
  'prizeCurrency',
  'attributes',
]);

/** apps/api `CompetitionWithEditionRequest.FirstEditionKeyDate`. */
const KEY_DATE_FIELDS = new Set(['type', 'label', 'startsAt', 'endsAt', 'timezone']);

const UPPER = /^[A-Z_]+$/;

test('submitToImportQueue POSTs the exact ImportSubmission contract shape', async () => {
  interface Captured {
    method: string | undefined;
    url: string | undefined;
    headers: Record<string, string | string[] | undefined>;
    body: Record<string, unknown>;
  }
  let captured: Captured | undefined;

  const server = createServer((req, res) => {
    let data = '';
    req.on('data', (chunk: Buffer) => {
      data += chunk.toString('utf8');
    });
    req.on('end', () => {
      captured = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: JSON.parse(data) as Record<string, unknown>,
      };
      res.writeHead(201, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 'rec-1', status: 'PENDING' }));
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as AddressInfo).port;

  try {
    const raw = JSON.parse(await readFile(fileURLToPath(fixtureUrl), 'utf8'));
    const extraction = normalize(raw, 'https://novamath.example.org');
    const submission: ImportSubmission = {
      payload: extraction.payload,
      sourceUrl: 'https://novamath.example.org', // H2: the FETCHED url, never payload.officialUrl
      confidence: scoreConfidence(extraction),
    };
    const config: Config = {
      anthropicApiKey: undefined,
      anthropicModel: 'unused',
      apiBase: `http://127.0.0.1:${port}`,
      adminToken: 'secret-token',
      userAgent: 'Test/1',
      fetchTimeoutMs: 5000,
    };

    const result = await submitToImportQueue(submission, config);
    assert.equal(result.id, 'rec-1');
    assert.equal(result.status, 'PENDING');

    assert.ok(captured, 'server captured the request');
    assert.equal(captured.method, 'POST');
    assert.equal(captured.url, '/api/v1/admin/import-records');
    assert.equal(captured.headers['x-admin-token'], 'secret-token');
    assert.equal(captured.headers['content-type'], 'application/json');

    // Top level: exactly the server ImportSubmission record's fields.
    assert.deepEqual(Object.keys(captured.body).sort(), ['confidence', 'payload', 'sourceUrl']);
    assert.equal(captured.body.sourceUrl, 'https://novamath.example.org');

    // confidence: number in [0,1], at most 2 decimals (server BigDecimal @DecimalMin/@DecimalMax).
    const confidence = captured.body.confidence;
    assert.ok(typeof confidence === 'number' && confidence >= 0 && confidence <= 1);
    assert.equal(Math.round(confidence * 100) / 100, confidence, 'confidence has ≤2 decimals');

    // payload: CompetitionRequest's fields plus the two declared seeding extras — no
    // categorySlug, nothing undeclared.
    const payload = captured.body.payload as Record<string, unknown>;
    for (const key of Object.keys(payload)) {
      assert.ok(
        COMPETITION_REQUEST_FIELDS.has(key) || SEED_PAYLOAD_EXTRAS.has(key),
        `unexpected payload field "${key}"`,
      );
    }
    assert.equal(payload.categorySlug, undefined);
    assert.equal(payload.description, null);
    assert.equal(typeof payload.slug, 'string');
    assert.equal(typeof payload.name, 'string');
    assert.equal(typeof payload.categoryId, 'string');

    // Enum casing: spine enums are the server enum CONSTANT names (Jackson binds case-
    // sensitively on approve); evaluationType is the canonical LOWERCASE token set.
    for (const field of [
      'participationMode',
      'delivery',
      'entryPathway',
      'costType',
      'recurrence',
    ]) {
      assert.ok(
        typeof payload[field] === 'string' && UPPER.test(payload[field] as string),
        `${field} must be an UPPERCASE enum constant (got ${String(payload[field])})`,
      );
    }
    const evaluationType = (payload.evaluationType ?? []) as string[];
    for (const token of evaluationType) {
      assert.equal(token, token.toLowerCase(), 'evaluationType tokens are lowercase');
    }

    // --- the first edition (S3 v1) ---
    const edition = payload.edition as Record<string, unknown>;
    assert.ok(edition, 'the fixture carries an edition');
    for (const key of Object.keys(edition)) {
      assert.ok(EDITION_REQUEST_FIELDS.has(key), `unexpected edition field "${key}"`);
    }
    // Jackson binds these case-sensitively into EditionStatus / ScopeLevel on approve.
    for (const field of ['status', 'scopeLevel']) {
      assert.ok(
        typeof edition[field] === 'string' && UPPER.test(edition[field] as string),
        `edition.${field} must be an UPPERCASE enum constant (got ${String(edition[field])})`,
      );
    }
    assert.equal(typeof edition.cycleLabel, 'string');

    // --- the timeline ---
    const keyDates = payload.keyDates as Record<string, unknown>[];
    assert.ok(Array.isArray(keyDates) && keyDates.length > 0, 'the fixture carries key dates');
    for (const row of keyDates) {
      for (const key of Object.keys(row)) {
        assert.ok(KEY_DATE_FIELDS.has(key), `unexpected key-date field "${key}"`);
      }
      assert.ok(
        typeof row.type === 'string' && UPPER.test(row.type),
        `key date type must be an UPPERCASE enum constant (got ${String(row.type)})`,
      );
    }
    // A TBD row must reach the server as an EXPLICIT null, not a dropped key: both decode to
    // "date unknown", but asserting the null keeps the honest-blank contract visible here.
    const tbd = keyDates.find((d) => d.type === 'RESULTS');
    assert.ok(tbd, 'the fixture keeps an undated RESULTS row');
    assert.equal(tbd.startsAt, null, 'an undated milestone serializes as null, not omitted');
  } finally {
    server.close();
  }
});
