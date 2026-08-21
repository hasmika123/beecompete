'use client';

import { useActionState, useEffect, useMemo, useState, useTransition } from 'react';
import {
  Alert,
  Button,
  Check,
  Checkbox,
  FormField,
  Input,
  Textarea,
  useToast,
} from '@beecompete/ui';
import { ImportEditionPanel } from '@/components/admin/import-edition-panel';
import { approveImport, searchOrganizations } from '@/app/admin/import-records/actions';
import type { FormState, ImportRecord, Organization } from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

/** Case- and whitespace-insensitive org-name key — mirrors the server's normalize on resolve. */
const nameKey = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * The raw-JSON escape hatch on the import review screen.
 *
 * This WAS the review surface; the full competition form replaced it as the default, because
 * editing a listing as JSON is not a review of it. It stays for the cases a form can't express:
 * a payload key with no field, a malformed extraction that has to be hand-repaired, or simply
 * seeing exactly what the pipeline produced.
 *
 * It is an INDEPENDENT form, not a second view of the same state: whichever tab the curator
 * submits is what gets approved. Keeping them unsynchronised is deliberate — a live two-way bind
 * between typed fields and free-text JSON is where "I edited it and it silently reverted" bugs
 * live, and this is the one screen where a silent data change is unacceptable.
 */
export function ImportRawPayloadForm({
  record,
  initialOrganizerMatches = [],
}: {
  record: ImportRecord;
  /** Orgs matching the extracted organizerName (fetched server-side); drives the organizer panel. */
  initialOrganizerMatches?: Organization[];
}) {
  const [state, formAction, approving] = useActionState(
    approveImport.bind(null, record.id),
    INITIAL,
  );
  // The editable payload is controlled JSON — the organizer panel patches it, the textarea edits it,
  // and its text is what the approve form submits.
  const [payloadText, setPayloadText] = useState(JSON.stringify(record.payload, null, 2));
  const { toast } = useToast();

  useEffect(() => {
    if (state.error) toast({ title: state.error, tone: 'error' });
  }, [state.error, toast]);

  // Parse the payload for the organizer panel; null while the JSON is mid-edit / not an object.
  const parsed = useMemo<Record<string, unknown> | null>(() => {
    try {
      const v: unknown = JSON.parse(payloadText);
      return v !== null && typeof v === 'object' && !Array.isArray(v)
        ? (v as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }, [payloadText]);
  const jsonInvalid = payloadText.trim() !== '' && parsed === null;

  const curName = parsed && typeof parsed.organizerName === 'string' ? parsed.organizerName : null;
  const curId = parsed && typeof parsed.organizerOrgId === 'string' ? parsed.organizerOrgId : null;
  const confirmNew = parsed?.confirmNewOrganizer === true;

  const patchPayload = (patch: (obj: Record<string, unknown>) => void): void => {
    if (!parsed) {
      toast({ title: 'Fix the JSON first. It doesn’t parse.', tone: 'error' });
      return;
    }
    const next = { ...parsed };
    patch(next);
    setPayloadText(JSON.stringify(next, null, 2));
  };

  // Pick an existing org → write organizerOrgId, drop the by-name fields (server reuses the id).
  const chooseOrg = (org: Organization) =>
    patchPayload((o) => {
      o.organizerOrgId = org.id;
      delete o.organizerName;
      delete o.confirmNewOrganizer;
    });
  const clearOrg = () => patchPayload((o) => delete o.organizerOrgId);
  const setConfirmNew = (v: boolean) =>
    patchPayload((o) => {
      if (v) o.confirmNewOrganizer = true;
      else delete o.confirmNewOrganizer;
    });

  // Match the extracted name against the pre-fetched orgs (server did the same query on load).
  const exactMatch = curName
    ? initialOrganizerMatches.find((m) => nameKey(m.name) === nameKey(curName) && !m.archivedAt)
    : undefined;
  const archivedExact = curName
    ? initialOrganizerMatches.find((m) => nameKey(m.name) === nameKey(curName) && m.archivedAt)
    : undefined;
  const nearMatches = curName
    ? initialOrganizerMatches.filter((m) => !m.archivedAt && nameKey(m.name) !== nameKey(curName))
    : [];

  return (
    <div className="grid gap-6">
      {state.error && <Alert tone="danger">{state.error}</Alert>}

      <Alert tone="info">
        This tab and the review form are <b>separate</b> edits — whichever one you submit is what
        gets approved. Nothing you type here shows up in the form, or the other way round.
      </Alert>

      {/* Organizer panel (resolve-or-create): reuse an existing org, or create a new one on approve. */}
      <div className="rounded-[var(--radius-panel)] border border-border p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Organizer</h2>
        {curId ? (
          <div className="grid gap-2">
            <p className="flex items-center gap-1.5 text-sm text-success">
              <Check aria-hidden="true" className="size-4" /> Resolved to an existing organization.
              No new org will be created.
            </p>
            <p className="text-xs text-muted">
              organizerOrgId: <code className="font-mono">{curId}</code>
            </p>
            <div>
              <Button type="button" variant="ghost" size="sm" onClick={clearOrg}>
                Choose a different organizer
              </Button>
            </div>
          </div>
        ) : curName ? (
          <div className="grid gap-3">
            <p className="text-sm">
              Extracted organizer: <span className="font-medium text-foreground">{curName}</span>
            </p>
            {archivedExact ? (
              <Alert tone="warning">
                A same-named organization is <b>archived</b>. Restore it or pick another. Approving
                will fail while an archived org matches the name.
              </Alert>
            ) : exactMatch ? (
              <p className="flex items-center gap-1.5 text-sm text-success">
                <Check aria-hidden="true" className="size-4" /> Exact match: “{exactMatch.name}”
                will be reused.
              </p>
            ) : nearMatches.length > 0 ? (
              <div className="grid gap-2">
                <p className="text-sm">No exact match. Possible existing organizations:</p>
                <ul className="grid gap-1">
                  {nearMatches.map((o) => (
                    <li
                      key={o.id}
                      className="flex items-center justify-between gap-2 rounded-[var(--radius-panel)] border border-border px-3 py-1.5 text-sm"
                    >
                      <span>{o.name}</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => chooseOrg(o)}>
                        Use this
                      </Button>
                    </li>
                  ))}
                </ul>
                <Checkbox
                  label={`Create as a new organization anyway (“${curName}”, CURATED)`}
                  checked={confirmNew}
                  onChange={(e) => setConfirmNew(e.target.checked)}
                />
                {!confirmNew && (
                  <p className="text-xs text-muted">
                    Approving is refused until you pick one above or confirm a new org.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted">
                No existing organization matches. A new one (“{curName}”, CURATED) will be created
                on approve.
              </p>
            )}
            <details className="text-sm">
              <summary className="cursor-pointer text-muted">
                Search for a different organization
              </summary>
              <div className="mt-2">
                <OrgSearch onPick={chooseOrg} />
              </div>
            </details>
          </div>
        ) : (
          <div className="grid gap-2">
            <Alert tone="warning">
              No organizer. Assign one before approving. Search below, or add an{' '}
              <code className="font-mono">organizerName</code> to the payload.
            </Alert>
            <OrgSearch onPick={chooseOrg} />
          </div>
        )}
      </div>

      {/* Edition + timeline (S3 v1). Sits above the JSON on purpose: approve now creates the
          edition and its key dates, so these are decisions the curator must make BEFORE
          approving — reading them out of the raw payload below is not a review. */}
      <ImportEditionPanel payload={parsed} onPatch={patchPayload} />

      <form action={formAction} className="grid gap-3">
        {/* The controlled payload text is what the server action reads. */}
        <input type="hidden" name="payload" value={payloadText} />
        <FormField
          label="Extracted payload (edit before approving)"
          hint="Approving validates this against the category template and creates the competition (provenance = import)."
          error={jsonInvalid ? 'Not valid JSON. Approving will fail until this parses.' : undefined}
        >
          <Textarea
            value={payloadText}
            onChange={(e) => setPayloadText(e.target.value)}
            rows={18}
            className="font-mono text-xs"
          />
        </FormField>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={approving || jsonInvalid}>
            <Check aria-hidden="true" className="size-4" />{' '}
            {approving ? 'Approving…' : 'Approve & create'}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Live organizer lookup (server action) — pick an existing org to reuse instead of creating one. */
function OrgSearch({ onPick }: { onPick: (org: Organization) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Organization[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, startSearch] = useTransition();
  const { toast } = useToast();

  const run = () => {
    const q = query.trim();
    if (!q) return;
    startSearch(async () => {
      try {
        setResults(await searchOrganizations(q));
        setSearched(true);
      } catch (e) {
        toast({ title: e instanceof Error ? e.message : 'Search failed', tone: 'error' });
      }
    });
  };

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              run();
            }
          }}
          placeholder="Search organizations by name…"
          aria-label="Search organizations"
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={searching || query.trim() === ''}
          onClick={run}
        >
          {searching ? 'Searching…' : 'Search'}
        </Button>
      </div>
      {searched && results.length === 0 && (
        <p className="text-xs text-muted">No organizations match “{query}”.</p>
      )}
      {results.length > 0 && (
        <ul className="grid gap-1">
          {results.map((o) => (
            <li
              key={o.id}
              className="flex items-center justify-between gap-2 rounded-[var(--radius-panel)] border border-border px-3 py-1.5 text-sm"
            >
              <span>
                {o.name}
                {o.archivedAt ? <span className="text-muted"> (archived)</span> : null}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={Boolean(o.archivedAt)}
                onClick={() => onPick(o)}
              >
                Use this
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
