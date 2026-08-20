import type { AttrRow } from '@/lib/detail-display';

// The detail page's label/value list, shared by the Details and About tabs (#106 — About needs
// the identical treatment for its leftover rows, so this moved out of key-facts.tsx).

export function DefinitionGrid({ rows }: { rows: AttrRow[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between gap-4 border-b border-border/60 pb-2">
          <dt className="text-sm text-muted">{row.label}</dt>
          <dd className="text-right text-sm font-medium text-foreground">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// h2 (not h3): these are the first headings in the main column after the page h1, and sibling
// sections (Prep resources, Related, Key dates) are h2 — an h3 would skip a level (WCAG 1.3.1).
// Level is independent of the small visual size.
export function Group({ title, rows }: { title: string; rows: AttrRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="grid gap-3">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <DefinitionGrid rows={rows} />
    </div>
  );
}
