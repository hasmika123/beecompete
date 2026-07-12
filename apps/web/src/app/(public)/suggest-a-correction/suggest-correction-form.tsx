'use client';

import { useActionState, useState } from 'react';
import { Alert, Button, FormField, Input, Plus, Select, Textarea, Trash } from '@beecompete/ui';
import { submitCorrection } from './actions';
import type { FormState } from '@/lib/admin-types';
import {
  COST_TYPES,
  DELIVERIES,
  EDITION_STATUSES,
  ENTRY_PATHWAYS,
  PARTICIPATION_MODES,
  RECURRENCES,
  RESOURCE_TYPES,
} from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };
const MAX_ROWS = 5;

interface FieldOption {
  key: string;
  label: string;
  /** When set, the value is one of these tokens (rendered as a select). */
  values?: readonly string[];
  hint?: string;
}

// Mirrors the server-side CorrectionFields whitelist (scalar fields only — the server remains
// the real gate). Friendly labels; enum fields offer their allowed tokens.
const FIELD_OPTIONS: Record<string, FieldOption[]> = {
  COMPETITION: [
    { key: 'name', label: 'Name' },
    { key: 'summary', label: 'Short summary' },
    { key: 'description', label: 'Description' },
    { key: 'officialUrl', label: 'Official website URL' },
    { key: 'minGrade', label: 'Minimum grade', hint: 'K = 0, Pre-K = -1, grades 1–12' },
    { key: 'maxGrade', label: 'Maximum grade', hint: 'K = 0, Pre-K = -1, grades 1–12' },
    { key: 'minAge', label: 'Minimum age' },
    { key: 'maxAge', label: 'Maximum age' },
    { key: 'costType', label: 'Cost', values: COST_TYPES },
    { key: 'participationMode', label: 'Individual or team', values: PARTICIPATION_MODES },
    { key: 'delivery', label: 'In person or online', values: DELIVERIES },
    { key: 'entryPathway', label: 'How you enter', values: ENTRY_PATHWAYS },
    { key: 'recurrence', label: 'How often it runs', values: RECURRENCES },
  ],
  EDITION: [
    { key: 'cycleLabel', label: 'Cycle (e.g. 2026)' },
    { key: 'status', label: 'Status', values: EDITION_STATUSES },
    { key: 'registrationUrl', label: 'Registration URL' },
    { key: 'entryFee', label: 'Entry fee', hint: 'Number only, e.g. 25.00' },
    { key: 'currency', label: 'Currency', hint: '3-letter code, e.g. USD' },
    { key: 'ageCutoffDate', label: 'Age cutoff date', hint: 'YYYY-MM-DD' },
    { key: 'prizeSummary', label: 'Prize summary' },
  ],
  RESOURCE: [
    { key: 'title', label: 'Title' },
    { key: 'url', label: 'URL' },
    { key: 'type', label: 'Type', values: RESOURCE_TYPES },
  ],
};

interface Row {
  field: string;
  value: string;
}

export function SuggestCorrectionForm({
  subjectType,
  subjectId,
  subjectName,
}: {
  subjectType: string;
  subjectId: string;
  subjectName?: string;
}) {
  const [state, formAction, submitting] = useActionState(submitCorrection, INITIAL);
  const [rows, setRows] = useState<Row[]>([{ field: '', value: '' }]);
  const options = FIELD_OPTIONS[subjectType] ?? [];

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  if (state.ok) {
    return (
      <Alert tone="success">
        Thanks — your correction was sent to our curators for review
        {subjectName ? ` (${subjectName})` : ''}. Nothing changes until a human checks it.
      </Alert>
    );
  }

  return (
    <form action={formAction} className="grid gap-5">
      {state.error && <Alert tone="danger">{state.error}</Alert>}

      <input type="hidden" name="subjectType" value={subjectType} />
      <input type="hidden" name="subjectId" value={subjectId} />
      {/* Honeypot — humans never see this; bots that fill it are dropped server-side. */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden"
      >
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="grid gap-4">
        {rows.map((row, i) => {
          const option = options.find((o) => o.key === row.field);
          return (
            <div key={i} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <input type="hidden" name="field" value={row.field} />
              <input type="hidden" name="value" value={row.value} />
              <FormField label={i === 0 ? 'What needs fixing?' : `Field ${i + 1}`}>
                <Select
                  aria-label="Field to correct"
                  placeholder="Pick a field…"
                  options={options.map((o) => ({ value: o.key, label: o.label }))}
                  value={row.field}
                  onValueChange={(field) => setRow(i, { field, value: '' })}
                />
              </FormField>
              <FormField label="Correct value" hint={option?.hint}>
                {option?.values ? (
                  <Select
                    aria-label="Correct value"
                    placeholder="Pick a value…"
                    options={option.values.map((v) => ({
                      value: v,
                      label: v.toLowerCase().replaceAll('_', ' '),
                    }))}
                    value={row.value}
                    onValueChange={(value) => setRow(i, { value })}
                  />
                ) : (
                  <Input
                    aria-label="Correct value"
                    value={row.value}
                    onChange={(e) => setRow(i, { value: e.target.value })}
                    disabled={!row.field}
                  />
                )}
              </FormField>
              {rows.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove field ${i + 1}`}
                  onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                >
                  <Trash aria-hidden="true" className="size-4" />
                </Button>
              ) : (
                <span />
              )}
            </div>
          );
        })}
      </div>

      {rows.length < MAX_ROWS && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="justify-self-start"
          onClick={() => setRows((prev) => [...prev, { field: '', value: '' }])}
        >
          <Plus aria-hidden="true" className="size-4" /> Add another field
        </Button>
      )}

      <FormField
        label="Anything else we should know? (optional)"
        hint="A link to the official source helps our curators verify the fix."
      >
        <Textarea name="note" rows={3} maxLength={2000} />
      </FormField>

      <Button type="submit" disabled={submitting} className="justify-self-start">
        {submitting ? 'Sending…' : 'Send correction'}
      </Button>
    </form>
  );
}
