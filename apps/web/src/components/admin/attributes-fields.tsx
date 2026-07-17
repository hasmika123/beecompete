'use client';

import { useState } from 'react';
import { Checkbox, Input, Textarea } from '@beecompete/ui';
import { Select } from '@beecompete/ui';
import { enumLabel } from '@/components/admin/enum-labels';

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
      {invalid && <p className="text-xs text-danger">Not valid JSON — last valid value kept.</p>}
    </div>
  );
}

export function AttributesFields({ schema, uiHints, value, onChange }: AttributesFieldsProps) {
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
  ];
  const extraKeys = Object.keys(value).filter((k) => !(k in properties));

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
            placeholder="— none —"
            options={[
              { value: '', label: '— none —' },
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

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {schemaKeys.map((key) => (
        <div key={key} className="grid content-start gap-1">
          <label htmlFor={`attr-${key}`} className="text-sm font-medium text-foreground">
            {hintString(hints, 'labels', key) ?? enumLabel(key)}
          </label>
          {field(key, properties[key] ?? {})}
        </div>
      ))}
      {extraKeys.map((key) => (
        <div key={key} className="grid content-start gap-1">
          <label htmlFor={`attr-${key}`} className="text-sm font-medium text-foreground">
            {enumLabel(key)}{' '}
            <span className="text-xs font-normal text-muted">(not in template)</span>
          </label>
          <RawJsonField
            id={`attr-${key}`}
            value={value[key]}
            onChange={(parsed) => set(key, parsed)}
          />
        </div>
      ))}
      {schemaKeys.length === 0 && extraKeys.length === 0 && (
        <p className="text-sm text-muted sm:col-span-2">
          This category&apos;s template declares no fields — add any via raw JSON.
        </p>
      )}
    </div>
  );
}
