'use client';

import { useMemo, useState } from 'react';
import { Checkbox, ChevronDown, ChevronRight, Chip, cn, Input } from '@beecompete/ui';
import type { Region } from '@/lib/admin-types';

/**
 * Region picker v2 (sweep item 22) — the ~80-row seeded registry (item 15) as a grouped,
 * searchable tree instead of a flat checkbox wall. Admin-only (create form + edition
 * RegionTagger), so it lives in the app, not packages/ui.
 *
 * Grouping follows the hierarchy: Country → its states → cities under a state; Virtual / Online
 * and any parentless rows render at the top level. Scope/delivery assist is SOFT (suggestion
 * chips + auto-opened groups) — never a hard lock; the admin can always pick anything.
 */

const LEVEL_ORDER = ['VIRTUAL', 'COUNTRY', 'STATE', 'COUNTY', 'CITY'];

interface RegionNode {
  region: Region;
  children: RegionNode[];
}

function byLevelThenName(a: Region, b: Region): number {
  const order = LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level);
  return order !== 0 ? order : a.name.localeCompare(b.name);
}

/** Parent-linked tree; rows whose parent is missing from the list surface as roots. */
function buildTree(regions: Region[]): RegionNode[] {
  const ids = new Set(regions.map((r) => r.id));
  const childrenByParent = new Map<string, Region[]>();
  const roots: Region[] = [];
  for (const r of regions) {
    if (r.parentId !== null && ids.has(r.parentId)) {
      const siblings = childrenByParent.get(r.parentId) ?? [];
      siblings.push(r);
      childrenByParent.set(r.parentId, siblings);
    } else {
      roots.push(r);
    }
  }
  const toNode = (r: Region): RegionNode => ({
    region: r,
    children: (childrenByParent.get(r.id) ?? []).sort(byLevelThenName).map(toNode),
  });
  return roots.sort(byLevelThenName).map(toNode);
}

export function RegionPicker({
  regions,
  selectedIds,
  onToggle,
  scopeLevel,
  delivery,
}: {
  regions: Region[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  /** Edition scope level — NATIONAL suggests the US; STATE/REGIONAL opens the country groups. */
  scopeLevel?: string;
  /** Competition delivery — VIRTUAL suggests the Virtual / Online region. */
  delivery?: string;
}) {
  const [query, setQuery] = useState('');
  // Expansion = explicit user toggles layered over a scope-derived default: a state-/regional-
  // scoped edition almost always tags states, so country groups default OPEN there (soft assist —
  // a user's own toggle always wins, and nothing is ever locked).
  const [expandOverrides, setExpandOverrides] = useState<Map<string, boolean>>(new Map());
  const defaultOpen = (r: Region) =>
    r.level === 'COUNTRY' && (scopeLevel === 'STATE' || scopeLevel === 'REGIONAL');
  const isExpanded = (r: Region) => expandOverrides.get(r.id) ?? defaultOpen(r);

  const tree = useMemo(() => buildTree(regions), [regions]);
  const regionById = useMemo(() => new Map(regions.map((r) => [r.id, r])), [regions]);

  const suggestions = useMemo(() => {
    const out: Region[] = [];
    if (delivery === 'VIRTUAL') out.push(...regions.filter((r) => r.level === 'VIRTUAL'));
    if (scopeLevel === 'NATIONAL') {
      const us = regions.find((r) => r.level === 'COUNTRY' && r.code === 'US');
      if (us) out.push(us);
    }
    return out.filter((r) => !selectedIds.includes(r.id));
  }, [regions, delivery, scopeLevel, selectedIds]);

  if (regions.length === 0) {
    return (
      <p className="text-sm text-muted">No regions defined yet — add them under Regions first.</p>
    );
  }

  const q = query.trim().toLowerCase();
  const matches = (r: Region) =>
    q === '' || r.name.toLowerCase().includes(q) || (r.code ?? '').toLowerCase() === q;
  const subtreeMatches = (node: RegionNode): boolean =>
    matches(node.region) || node.children.some(subtreeMatches);

  const toggleExpanded = (r: Region) =>
    setExpandOverrides((prev) => new Map(prev).set(r.id, !isExpanded(r)));

  const renderNode = (node: RegionNode, depth: number) => {
    if (q !== '' && !subtreeMatches(node)) return null;
    const { region, children } = node;
    // While filtering, groups holding a match open themselves so the match is visible.
    const open = q !== '' ? children.some(subtreeMatches) : isExpanded(region);
    return (
      <li key={region.id}>
        <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 1.25}rem` }}>
          {children.length > 0 ? (
            <button
              type="button"
              onClick={() => toggleExpanded(region)}
              aria-expanded={open}
              aria-label={`${open ? 'Collapse' : 'Expand'} ${region.name}`}
              className="grid size-5 shrink-0 place-items-center rounded text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {open ? (
                <ChevronDown aria-hidden="true" className="size-3.5" />
              ) : (
                <ChevronRight aria-hidden="true" className="size-3.5" />
              )}
            </button>
          ) : (
            <span aria-hidden="true" className="size-5 shrink-0" />
          )}
          <Checkbox
            checked={selectedIds.includes(region.id)}
            onChange={() => onToggle(region.id)}
            label={
              <>
                {region.name}
                {region.code && <span className="ml-1.5 text-xs text-muted">{region.code}</span>}
                {children.length > 0 && (
                  <span className="ml-1.5 text-xs text-muted">({children.length})</span>
                )}
              </>
            }
          />
        </div>
        {open && children.length > 0 && (
          <ul className="grid gap-1">{children.map((child) => renderNode(child, depth + 1))}</ul>
        )}
      </li>
    );
  };

  const visibleRoots = tree.filter((node) => q === '' || subtreeMatches(node));
  const selectedRegions = selectedIds
    .map((id) => regionById.get(id))
    .filter((r): r is Region => r !== undefined);

  return (
    <fieldset className="grid min-w-0 gap-2">
      <legend className="sr-only">Regions</legend>
      {selectedRegions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedRegions.map((r) => (
            <Chip
              key={r.id}
              selected
              onRemove={() => onToggle(r.id)}
              removeLabel={`Remove ${r.name}`}
              className="px-2.5 py-0.5 text-xs"
            >
              {r.name}
            </Chip>
          ))}
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">
            Suggested for {delivery === 'VIRTUAL' ? 'virtual delivery' : 'this scope'}:
          </span>
          {suggestions.map((r) => (
            <Chip key={r.id} onClick={() => onToggle(r.id)} className="px-2.5 py-0.5 text-xs">
              + {r.name}
            </Chip>
          ))}
        </div>
      )}
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter regions…"
        aria-label="Filter regions"
      />
      <div
        className={cn(
          'max-h-72 overflow-auto rounded-[var(--radius-field)] border border-border bg-surface p-3',
        )}
      >
        {visibleRoots.length === 0 ? (
          <p className="text-sm text-muted">No regions match “{query.trim()}”.</p>
        ) : (
          <ul className="grid gap-1">{visibleRoots.map((node) => renderNode(node, 0))}</ul>
        )}
      </div>
      <p className="text-xs text-muted">
        {selectedIds.length} selected{selectedIds.length === 0 ? ' — pick at least one' : ''}
      </p>
    </fieldset>
  );
}
