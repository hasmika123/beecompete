'use client';

import { useState } from 'react';
import { Button, Checkbox, Input, Plus, Textarea, Trash } from '@beecompete/ui';
import { Select } from '@beecompete/ui';
import { enumLabel } from '@/components/admin/enum-labels';
import { SubSectionHeading } from '@/components/admin/form-section';

/**
 * Schema-driven fields for a competition's `attributes` bag (sweep item 8 / A7): renders the
 * category template's JSON Schema as typed inputs instead of one raw-JSON textarea. Purely a
 * UX layer — the parent serializes the object back into the form's `attributes` field, so the
 * server action + networknt schema validation path is untouched (server stays the real gate).
 *
 * Supported subset (everything the 11 launch templates use, plus the contract's headroom):
 *   string          → Input (enum → NativeSelect; format "uri" → type=url; uiHints widget
 *                     "textarea" → Textarea)
 *   number/integer  → number Input (schema minimum/maximum → min/max; integer → step 1)
 *   boolean         → Checkbox
 *   array<string>   → comma-separated Input
 * Anything else (nested objects, oneOf, array-of-object, untyped) falls back to a raw-JSON
 * textarea FOR THAT KEY ONLY — as do bag keys the schema doesn't declare (additionalProperties
 * is permissive at R1; never hide or drop data).
 *
 * uiHints contract (authoritative shape — template editor documents it):
 *   { "order":        ["topics", "rounds"],
 *     "labels":       { "topics": "Covered topics" },
 *     "placeholders": { "topics": "algebra, geometry" },
 *     "widgets":      { "notes": "textarea" } }
 */

interface SchemaProperty {
  type?: string | string[];
  enum?: unknown[];
  format?: string;
  minimum?: number;
  maximum?: number;
  items?: { type?: string };
}

export interface AttributesFieldsProps {
  schema: Record<string, unknown>;
  uiHints: Record<string, unknown> | null;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  /**
   * Keys another surface renders with dedicated controls (e.g. the Judging step) — skipped here
   * in BOTH the declared and undeclared passes so nothing renders twice. Render-only: the keys
   * stay in `value` and survive every onChange merge untouched.
   */
  omitKeys?: string[];
}

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const hintString = (hints: Record<string, unknown>, group: string, key: string) => {
  const g = asRecord(hints[group]);
  return typeof g[key] === 'string' ? (g[key] as string) : undefined;
};

function isStringArrayProp(prop: SchemaProperty): boolean {
  return prop.type === 'array' && (prop.items?.type ?? 'string') === 'string';
}

/** Comma-separated editor for array<string> — local text so typing ", " isn't re-normalized. */
function CsvField({
  id,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  placeholder?: string;
  value: unknown;
  onChange: (items: string[] | undefined) => void;
}) {
  const [text, setText] = useState(Array.isArray(value) ? value.join(', ') : '');
  return (
    <Input
      id={id}
      value={text}
      placeholder={placeholder ?? 'comma-separated'}
      onChange={(e) => {
        setText(e.target.value);
        const items = e.target.value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        onChange(items.length ? items : undefined);
      }}
    />
  );
}

/** Raw-JSON escape hatch for one key — parse errors stay local and never clobber the bag. */
function RawJsonField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: unknown;
  onChange: (parsed: unknown) => void;
}) {
  const [text, setText] = useState(value === undefined ? '' : JSON.stringify(value, null, 2));
  const [invalid, setInvalid] = useState(false);
  return (
    <div className="grid gap-1">
      <Textarea
        id={id}
        value={text}
        rows={3}
        className="font-mono text-xs"
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          if (!next.trim()) {
            setInvalid(false);
            onChange(undefined);
            return;
          }
          try {
            onChange(JSON.parse(next));
            setInvalid(false);
          } catch {
            setInvalid(true); // keep typing — the last valid value stays in the bag
          }
        }}
      />
      {invalid && <p className="text-xs text-danger">Not valid JSON. Last valid value kept.</p>}
    </div>
  );
}

interface DraftField {
  id: number;
  k: string;
  v: string;
}

/** trim + spaces to underscores — attribute keys are snake-ish, matching the template style. */
const normalizeKey = (raw: string) => raw.trim().replace(/\s+/g, '_');

export function AttributesFields({
  schema,
  uiHints,
  value,
  onChange,
  omitKeys = [],
}: AttributesFieldsProps) {
  const omitted = new Set(omitKeys);
  // Add-a-field rows (owner 2026-08-23): a draft lives locally until its key is committable —
  // non-blank, not a template key (those have real controls above), not already in the bag.
  // One blank row is present from the start (owner 2026-08-24) so the tab opens ready to type
  // instead of behind an "Add field" click. A blank draft never commits, so it adds nothing to
  // the bag if left untouched; discarding it is allowed — "Add field" brings one back.
  const [templateDrafts, setTemplateDrafts] = useState<DraftField[]>([{ id: 0, k: '', v: '' }]);
  const [extraDrafts, setExtraDrafts] = useState<DraftField[]>([{ id: 1, k: '', v: '' }]);
  const [nextDraftId, setNextDraftId] = useState(2);
  const properties = asRecord(schema.properties) as Record<string, SchemaProperty>;
  const hints = asRecord(uiHints);
  const order = Array.isArray(hints.order)
    ? (hints.order as unknown[]).filter((k): k is string => typeof k === 'string')
    : [];

  // uiHints.order first (unknown keys ignored), then the schema's remaining keys, then bag
  // keys the schema doesn't declare (rendered raw so nothing is hidden).
  const schemaKeys = [
    ...order.filter((k) => k in properties),
    ...Object.keys(properties).filter((k) => !order.includes(k)),
  ].filter((k) => !omitted.has(k));
  const extraKeys = Object.keys(value).filter((k) => !(k in properties) && !omitted.has(k));

  const set = (key: string, v: unknown) => {
    const next = { ...value };
    if (v === undefined) {
      delete next[key];
    } else {
      next[key] = v;
    }
    onChange(next);
  };

  const field = (key: string, prop: SchemaProperty) => {
    const id = `attr-${key}`;
    const placeholder = hintString(hints, 'placeholders', key);
    const widget = hintString(hints, 'widgets', key);
    const v = value[key];

    if (prop.type === 'boolean') {
      return (
        <Checkbox
          checked={v === true}
          onChange={(e) => set(key, e.target.checked)}
          label={<span className="text-sm">Yes</span>}
        />
      );
    }
    if (prop.type === 'number' || prop.type === 'integer') {
      return (
        <Input
          id={id}
          type="number"
          value={typeof v === 'number' ? String(v) : ''}
          placeholder={placeholder}
          min={prop.minimum}
          max={prop.maximum}
          step={prop.type === 'integer' ? 1 : 'any'}
          onChange={(e) => set(key, e.target.value === '' ? undefined : Number(e.target.value))}
        />
      );
    }
    if (prop.type === 'string') {
      if (Array.isArray(prop.enum) && prop.enum.length > 0) {
        return (
          <Select
            id={id}
            value={typeof v === 'string' ? v : ''}
            placeholder="None"
            options={[
              { value: '', label: 'None' },
              ...prop.enum
                .filter((o): o is string => typeof o === 'string')
                .map((o) => ({ value: o, label: o })),
            ]}
            onValueChange={(val) => set(key, val || undefined)}
          />
        );
      }
      if (widget === 'textarea') {
        return (
          <Textarea
            id={id}
            value={typeof v === 'string' ? v : ''}
            placeholder={placeholder}
            rows={3}
            onChange={(e) => set(key, e.target.value || undefined)}
          />
        );
      }
      return (
        <Input
          id={id}
          type={prop.format === 'uri' ? 'url' : 'text'}
          value={typeof v === 'string' ? v : ''}
          placeholder={placeholder}
          onChange={(e) => set(key, e.target.value || undefined)}
        />
      );
    }
    if (isStringArrayProp(prop)) {
      return (
        <CsvField
          id={id}
          placeholder={placeholder}
          value={v}
          onChange={(items) => set(key, items)}
        />
      );
    }
    // Unsupported shape → raw JSON for this key only.
    return <RawJsonField id={id} value={v} onChange={(parsed) => set(key, parsed)} />;
  };

  // Both sections carry their own add-a-field rows (owner 2026-08-24), so a curator adds a field
  // where they were already looking instead of scrolling to one shared control. They write to the
  // same bag — the TEMPLATE is what makes a key "category-specific", so a key typed in either row
  // is by definition an extra one and lands under Other fields once committed. Each list keeps
  // one blank row from the start so both sections open ready to type; a blank draft never
  // commits, so an untouched row adds nothing.
  const draftRows = (
    drafts: DraftField[],
    setDrafts: (fn: (ds: DraftField[]) => DraftField[]) => void,
    context: string,
  ) => (
    <>
      {drafts.map((d) => {
        const norm = normalizeKey(d.k);
        const clash = norm !== '' && (norm in properties || norm in value);
        const commit = () => {
          if (norm === '' || clash) return;
          set(norm, d.v);
          // Consume the draft and leave a fresh blank behind when it was the last one, so the
          // section never runs out of somewhere to type (owner 2026-08-24: both sections keep a
          // ready name+value row). `nextDraftId` still advances, so keys stay unique.
          setDrafts((ds) => {
            const rest = ds.filter((x) => x.id !== d.id);
            return rest.length > 0 ? rest : [{ id: nextDraftId, k: '', v: '' }];
          });
          setNextDraftId((n) => n + 1);
        };
        return (
          <div key={d.id} className="grid grid-cols-[180px_1fr_32px] items-start gap-2">
            <div className="grid gap-1">
              <Input
                aria-label={`New ${context} field name`}
                placeholder="field_name"
                value={d.k}
                onChange={(e) =>
                  setDrafts((ds) =>
                    ds.map((x) => (x.id === d.id ? { ...x, k: e.target.value } : x)),
                  )
                }
                onBlur={commit}
              />
              {clash && <p className="text-xs text-danger">already a field above</p>}
            </div>
            <Input
              aria-label={`New ${context} field value`}
              placeholder="value"
              value={d.v}
              onChange={(e) =>
                setDrafts((ds) => ds.map((x) => (x.id === d.id ? { ...x, v: e.target.value } : x)))
              }
              onBlur={commit}
            />
            <button
              type="button"
              aria-label={`Discard new ${context} field`}
              onClick={() => setDrafts((ds) => ds.filter((x) => x.id !== d.id))}
              className="grid size-8 place-items-center rounded-md text-muted hover:bg-background hover:text-danger"
            >
              <Trash aria-hidden="true" className="size-4" />
            </button>
          </div>
        );
      })}
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setDrafts((ds) => [...ds, { id: nextDraftId, k: '', v: '' }]);
            setNextDraftId((n) => n + 1);
          }}
        >
          <Plus aria-hidden="true" className="size-4" /> Add field
        </Button>
      </div>
    </>
  );

  return (
    // Two titled sections (owner 2026-08-24): what the category template asks for, then
    // everything else. The split was implicit before — one grid of controls with a conditional
    // grey caption partway down — so a curator could not tell which fields the category expected
    // from which ones a previous curator had improvised.
    <div className="grid gap-6">
      <section className="grid gap-3">
        <SubSectionHeading
          title="Category-specific fields"
          hint={
            schemaKeys.length === 0
              ? 'This category’s template declares no fields of its own — add what the listing needs below.'
              : 'The fields this category’s template declares. They appear automatically and are validated against the template on save.'
          }
        />
        {schemaKeys.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {schemaKeys.map((key) => (
              <div key={key} className="grid content-start gap-1">
                <label htmlFor={`attr-${key}`} className="text-sm font-medium text-foreground">
                  {hintString(hints, 'labels', key) ?? enumLabel(key)}
                </label>
                {field(key, properties[key] ?? {})}
              </div>
            ))}
          </div>
        )}
        <div className="grid gap-2">{draftRows(templateDrafts, setTemplateDrafts, 'category')}</div>
      </section>

      <section className="grid gap-3">
        <SubSectionHeading
          title="Other fields"
          hint="Anything this category’s template doesn’t declare. Stored on the listing and shown on the public Overview tab."
        />
        <div className="grid gap-2">
          {extraKeys.map((key) => (
            <div key={key} className="grid grid-cols-[180px_1fr_32px] items-start gap-2">
              <Input value={key} readOnly aria-label={`Field ${key} name`} className="bg-surface" />
              {typeof value[key] === 'string' ? (
                <Input
                  aria-label={`Field ${key} value`}
                  value={value[key] as string}
                  onChange={(e) => set(key, e.target.value)}
                />
              ) : (
                <RawJsonField
                  id={`attr-${key}`}
                  value={value[key]}
                  onChange={(parsed) => set(key, parsed)}
                />
              )}
              <button
                type="button"
                aria-label={`Remove field ${key}`}
                onClick={() => set(key, undefined)}
                className="grid size-8 place-items-center rounded-md text-muted hover:bg-background hover:text-danger"
              >
                <Trash aria-hidden="true" className="size-4" />
              </button>
            </div>
          ))}
          {draftRows(extraDrafts, setExtraDrafts, 'other')}
        </div>
      </section>
    </div>
  );
}
