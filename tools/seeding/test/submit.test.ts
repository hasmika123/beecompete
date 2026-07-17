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
  'summary',
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

    // payload: a strict subset of CompetitionRequest's fields — no categorySlug, no extras.
    const payload = captured.body.payload as Record<string, unknown>;
    for (const key of Object.keys(payload)) {
      assert.ok(COMPETITION_REQUEST_FIELDS.has(key), `unexpected payload field "${key}"`);
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
  } finally {
    server.close();
  }
});
