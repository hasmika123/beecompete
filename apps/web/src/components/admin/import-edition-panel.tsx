'use client';

import { Alert, Checkbox, Input, Select, Trash } from '@beecompete/ui';
import { enumLabel } from '@/components/admin/enum-labels';
import { formatInZone } from '@/lib/dates';
import { ADMIN_TIMEZONES, KEY_DATE_TYPES } from '@/lib/admin-types';
import {
  asText as str,
  fromLocalInputValue,
  timelineFlags,
  toLocalInputValue as toLocalInput,
  type RawKeyDateRow as KeyDateRow,
} from '@/lib/import-edition';

/**
 * The extracted first edition + its timeline, on the import-review screen (S3 v1, phase 3).
 *
 * WHY THIS EXISTS: approve now creates the edition and its key dates alongside the competition, so
 * without this panel a curator approves dates they never actually saw — the payload textarea shows
 * them, but as raw JSON, which is not a review surface for the one field class most likely to be
 * wrong. Dates are also the slowest part of S4, so making them reviewable/editable here is where
 * the curation time goes.
 *
 * SCOPE: dates are editable (that is the expensive part); the edition's scalars are read-only and
 * still edited in the JSON below, or on the real edition after approve. Rows can be marked TBD or
 * removed, but not added — a milestone the page never mentioned is a curator judgement that belongs
 * on the created edition, where the full KeyDateManager already lives.
 */

export function ImportEditionPanel({
  payload,
  onPatch,
}: {
  /** Parsed payload, or null while the JSON textarea is mid-edit. */
  payload: Record<string, unknown> | null;
  onPatch: (patch: (obj: Record<string, unknown>) => void) => void;
}) {
  // Mid-edit JSON: the textarea owns the truth, so show nothing rather than a stale panel.
  if (!payload) return null;

  const edition =
    payload.edition && typeof payload.edition === 'object' && !Array.isArray(payload.edition)
      ? (payload.edition as Record<string, unknown>)
      : null;
  const rows: KeyDateRow[] = Array.isArray(payload.keyDates)
    ? (payload.keyDates as KeyDateRow[])
    : [];

  const patchRow = (index: number, patch: (row: Record<string, unknown>) => void) =>
    onPatch((obj) => {
      const list = Array.isArray(obj.keyDates)
        ? [...(obj.keyDates as Record<string, unknown>[])]
        : [];
      const next = { ...(list[index] ?? {}) };
      patch(next);
      list[index] = next;
      obj.keyDates = list;
    });

  const removeRow = (index: number) =>
    onPatch((obj) => {
      const list = Array.isArray(obj.keyDates) ? [...(obj.keyDates as unknown[])] : [];
      list.splice(index, 1);
      // Drop the key entirely rather than leaving []: approve rejects keyDates without an edition,
      // and an empty array is noise in the payload either way.
      if (list.length === 0) delete obj.keyDates;
      else obj.keyDates = list;
    });

  const setDate = (index: number, localValue: string) =>
    patchRow(index, (row) => {
      if (localValue === '') {
        row.startsAt = null;
        return;
      }
      const iso = fromLocalInputValue(localValue);
      if (iso) row.startsAt = iso;
    });

  const setTbd = (index: number, tbd: boolean) =>
    patchRow(index, (row) => {
      if (tbd) {
        row.startsAt = null;
        // endsAt without a startsAt is rejected server-side, so it goes with it.
        delete row.endsAt;
      }
    });

  const { missingDeadline, allTbd } = timelineFlags(rows);

  return (
    <div className="rounded-[var(--radius-panel)] border border-border p-4">
      <h2 className="mb-3 text-sm font-semibold text-foreground">Edition &amp; timeline</h2>

      {!edition ? (
        <Alert tone="warning">
          <b>No edition was extracted.</b> Approving creates the competition with no running, and
          the public readiness gate hides listings that have none — so it would be published but
          invisible. Add an <code className="font-mono">edition</code> to the JSON below, or approve
          and create the edition straight afterwards.
        </Alert>
      ) : (
        <div className="grid gap-3">
          <dl className="grid gap-1 text-sm">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted">Cycle:</dt>
              <dd className="font-medium text-foreground">{str(edition.cycleLabel) ?? '–'}</dd>
              <dt className="ml-3 text-muted">Status:</dt>
              <dd>{str(edition.status) ? enumLabel(str(edition.status) as string) : '–'}</dd>
              <dt className="ml-3 text-muted">Scope:</dt>
              <dd>
                {str(edition.scopeLevel) ? enumLabel(str(edition.scopeLevel) as string) : '–'}
              </dd>
            </div>
            {str(edition.registrationUrl) && (
              <div className="flex gap-2">
                <dt className="text-muted">Register:</dt>
                <dd className="truncate">
                  <a
                    href={str(edition.registrationUrl) as string}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    {str(edition.registrationUrl)}
                  </a>
                </dd>
              </div>
            )}
            {(edition.entryFee != null || str(edition.prizeSummary)) && (
              <div className="flex flex-wrap gap-x-2">
                {edition.entryFee != null && (
                  <>
                    <dt className="text-muted">Fee:</dt>
                    <dd>
                      {String(edition.entryFee)} {str(edition.currency) ?? ''}
                    </dd>
                  </>
                )}
                {str(edition.prizeSummary) && (
                  <>
                    <dt className="ml-3 text-muted">Prize:</dt>
                    <dd>{str(edition.prizeSummary)}</dd>
                  </>
                )}
              </div>
            )}
          </dl>

          {/* The two states worth a curator's attention before approving. Neither blocks: an
              undated page is a legitimate extraction, it just needs a human to chase the dates. */}
          {missingDeadline && (
            <Alert tone="warning">
              No <b>registration-close</b> or <b>submission-due</b> row, so the card and search will
              show this listing with no deadline.
            </Alert>
          )}
          {allTbd && (
            <Alert tone="info">
              Every date is <b>TBD</b>. That is the correct extraction for a page that announces
              milestones without dating them — the extractor never guesses — but it means these
              dates need looking up.
            </Alert>
          )}

          {rows.length === 0 ? (
            <p className="text-sm text-muted">No key dates were extracted.</p>
          ) : (
            <ul className="grid gap-2">
              {rows.map((row, i) => {
                const iso = str(row.startsAt);
                const zone = str(row.timezone);
                const type = str(row.type);
                return (
                  <li
                    key={`${String(type)}-${i}`}
                    className="grid gap-2 rounded-[var(--radius-input)] border border-border p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {type && KEY_DATE_TYPES.includes(type as never)
                          ? enumLabel(type)
                          : `Unknown type: ${String(row.type)}`}
                        {str(row.label) ? (
                          <span className="ml-1 font-normal text-muted">· {str(row.label)}</span>
                        ) : null}
                      </span>
                      <span className="text-sm text-muted">
                        {/* When the row carries no timezone, render in UTC rather than letting
                            formatInZone fall back to Eastern. The extractor emits T00:00:00Z for a
                            page that gives a day but no clock time, and Eastern would show that as
                            the PREVIOUS calendar day — "Nov. 3" on the page becoming "Nov 2" here,
                            on most date-only extractions. Showing UTC keeps the day as extracted. */}
                        {iso ? formatInZone(iso, zone ?? 'UTC') : 'Date TBD'}
                      </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                      <Input
                        type="datetime-local"
                        aria-label={`Date for ${type ? enumLabel(type) : 'this milestone'}`}
                        value={toLocalInput(iso)}
                        onChange={(e) => setDate(i, e.currentTarget.value)}
                      />
                      <Select
                        aria-label="Timezone"
                        options={ADMIN_TIMEZONES}
                        value={zone ?? ''}
                        placeholder="Timezone"
                        onValueChange={(v) =>
                          patchRow(i, (r) => {
                            if (v) r.timezone = v;
                            else delete r.timezone;
                          })
                        }
                      />
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        aria-label={`Remove ${type ? enumLabel(type) : 'this'} key date`}
                        className="justify-self-start rounded-full p-2 text-muted hover:bg-surface-raised hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <Trash aria-hidden="true" className="size-4" />
                      </button>
                    </div>
                    <Checkbox
                      label="Date TBD (to be determined)"
                      checked={!iso}
                      onChange={(e) => setTbd(i, e.currentTarget.checked)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-xs text-muted">
            Times are entered in <b>your browser&apos;s</b> timezone and stored as an absolute
            instant; the timezone above is what the public page displays it in. Other edition fields
            are edited in the JSON below, or on the edition itself after approve.
          </p>
        </div>
      )}
    </div>
  );
}
