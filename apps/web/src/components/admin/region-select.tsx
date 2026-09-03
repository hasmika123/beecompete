'use client';

import { useMemo, useRef, useState } from 'react';
import { Chip, cn } from '@beecompete/ui';
import type { Region } from '@/lib/admin-types';

/**
 * Region picker v3 (owner 2026-08-23): searchable combobox + chips — the Tags-field gesture
 * applied to the region registry. Replaces the grouped checkbox tree on the competition form
 * (RegionPicker survives for the edition RegionTagger until it migrates too).
 *
 * Same contract as before: the caller owns `selectedIds`/`onToggle`; posting stays the caller's
 * hidden-inputs job, so the server sees the identical `edition_regionIds` payload.
 */

export interface RegionSelectProps {
  regions: Region[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  /** Field label context, e.g. "Location" vs "Who can enter" — used for the input's aria-label. */
  ariaLabel?: string;
  placeholder?: string;
}

const LEVEL_LABEL: Record<string, string> = {
  VIRTUAL: 'Online',
  INTERNATIONAL: 'International',
  COUNTRY: 'Country',
  STATE: 'State',
  COUNTY: 'County',
  CITY: 'City',
};

/** Broad rungs outrank narrow ones on equal match quality — a curator reaching for "Washington"
 *  almost always wants the state, not one of the cities that share the word. */
const LEVEL_RANK: Record<string, number> = {
  VIRTUAL: 0,
  INTERNATIONAL: 1,
  COUNTRY: 2,
  STATE: 3,
  COUNTY: 4,
  CITY: 5,
};

const MAX_MATCHES = 10;

export function RegionSelect({
  regions,
  selectedIds,
  onToggle,
  ariaLabel = 'Regions',
  placeholder = 'Type a state, country, or city…',
}: RegionSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = new Set(selectedIds);
  const byId = useMemo(() => new Map(regions.map((r) => [r.id, r])), [regions]);

  /** A region's parent name — the disambiguator once the registry holds real city coverage. */
  const parentName = (r: Region) => (r.parentId ? (byId.get(r.parentId)?.name ?? null) : null);

  // Searchable text per region: its own name, its parent's, and its code. Built once per regions
  // change rather than per keystroke — the registry is ~1050 rows since `0018` seeded the top
  // 1000 US cities, so re-deriving this inside the filter would be 1050 string builds per key.
  const haystack = useMemo(() => {
    const map = new Map(regions.map((r) => [r.id, r]));
    return new Map(
      regions.map((r) => {
        const parent = r.parentId ? map.get(r.parentId)?.name : undefined;
        return [r.id, [r.name, parent, r.code].filter(Boolean).join(' ').toLowerCase()];
      }),
    );
  }, [regions]);

  // Every whitespace-separated token must appear somewhere in that text — so "columbus ohio"
  // finds the right one of the three Columbuses, which a single substring match could not.
  // Ranking: unselected first, then name-prefix matches, then broad rungs, then alphabetical.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const tokens = q.split(/\s+/);
    const scored = regions.filter((r) => {
      const text = haystack.get(r.id) ?? '';
      return tokens.every((t) => text.includes(t));
    });
    const prefix = (r: Region) => (r.name.toLowerCase().startsWith(tokens[0] ?? '') ? 0 : 1);
    return scored
      .sort(
        (a, b) =>
          Number(selected.has(a.id)) - Number(selected.has(b.id)) ||
          prefix(a) - prefix(b) ||
          (LEVEL_RANK[a.level] ?? 9) - (LEVEL_RANK[b.level] ?? 9) ||
          a.name.localeCompare(b.name),
      )
      .slice(0, MAX_MATCHES);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, regions, haystack, selectedIds]);

  // A typed query always answers for itself (owner 2026-09-03). Rendering nothing on zero matches
  // made an unpicked query read as a filled field — "Worldwide" sitting in the box looks exactly
  // like a value, but no region carries that name, so nothing was selected and the required ring
  // reddened a step whose every visible control was answered.
  const listOpen = open && query.trim() !== '';

  const pick = (id: string) => {
    if (!selected.has(id)) onToggle(id);
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  };

  const chipLabel = (r: Region) => [r.name, parentName(r)].filter(Boolean).join(', ');

  return (
    <div className="grid gap-2">
      <div className="relative">
        {/* Selections live INSIDE the field (owner 2026-08-31), not on a chip row beneath it. The
            shell carries the input chrome — border, radius, focus ring via focus-within — and the
            bare input sits after the chips, the same construction TagsInput uses. A separate row
            below read as a second control and pushed everything under it down as regions were
            added; in-field, the selection IS the field's value, which is what it always was. */}
        <div
          className={cn(
            'flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-[var(--radius-field)] border border-border bg-background px-2 py-1.5',
            'focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-ring',
          )}
        >
          {selectedIds.map((id) => {
            const r = byId.get(id);
            // The chip carries the parent too — "Springfield" alone doesn't say which one.
            const label = r ? chipLabel(r) : id;
            return (
              <Chip
                key={id}
                selected
                onRemove={() => onToggle(id)}
                removeLabel={`Remove ${label}`}
                className="px-2.5 py-0.5 text-xs"
              >
                {label}
              </Chip>
            );
          })}
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={listOpen && matches.length > 0}
            aria-controls="region-select-listbox"
            aria-label={ariaLabel}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              // Enter picks the top match; never submits the form from this field.
              if (e.key === 'Enter') {
                e.preventDefault();
                if (matches[0]) pick(matches[0].id);
              }
              if (e.key === 'Escape') setOpen(false);
            }}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={selectedIds.length > 0 ? 'Add another…' : placeholder}
            className={cn(
              'h-7 min-w-32 flex-1 bg-transparent px-1.5 text-sm text-foreground',
              'placeholder:text-muted focus:outline-none',
            )}
          />
        </div>
        {listOpen && matches.length === 0 && (
          // Same chrome as the list, so the answer arrives where the options would have. `status`
          // (not `alert`) announces it to a screen reader without interrupting typing.
          <div
            role="status"
            className={cn(
              'absolute z-20 mt-1 w-full rounded-[var(--radius-field)] border border-border bg-surface-raised px-3.5 py-2',
              'text-sm text-muted shadow-[var(--shadow-popover)]',
            )}
          >
            No region matches “{query.trim()}” — try a country, state, or city name, or the two rows
            that are not places: “Online” and “International”.
          </div>
        )}
        {listOpen && matches.length > 0 && (
          <ul
            id="region-select-listbox"
            role="listbox"
            className="absolute z-20 mt-1 w-full overflow-hidden rounded-[var(--radius-field)] border border-border bg-surface-raised shadow-[var(--shadow-popover)]"
          >
            {matches.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected.has(r.id)}
                  // onMouseDown, not onClick: the input's onBlur closes the list before click lands.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(r.id);
                  }}
                  disabled={selected.has(r.id)}
                  className={cn(
                    'flex w-full items-center justify-between px-3.5 py-2 text-left text-sm',
                    selected.has(r.id)
                      ? 'cursor-default text-muted'
                      : 'text-foreground hover:bg-background',
                  )}
                >
                  <span className="min-w-0 truncate">
                    {r.name}
                    {/* The parent, inline and muted — without it the five Springfields and three
                        Columbuses seeded by `0018` render as identical rows. Only for nested
                        rungs: a country or the Online region has nothing to disambiguate. */}
                    {parentName(r) && <span className="text-muted">{`, ${parentName(r)}`}</span>}
                  </span>
                  <span className="shrink-0 pl-3 text-xs text-muted">
                    {LEVEL_LABEL[r.level] ?? r.level}
                    {r.code ? ` · ${r.code}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
