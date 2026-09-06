import type { ReactNode } from 'react';

/**
 * Consistent admin page title row: heading + optional right-aligned actions (e.g. "New").
 * `badge` sits on the title line (a listing's status), `meta` is the quiet fact strip under it
 * (provenance, public URL, last change) — both optional, both added for the listing page
 * 2026-09-05 so a record's identity reads in one glance instead of three stacked lines.
 */
export function PageHeader({
  title,
  description,
  badge,
  meta,
  actions,
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="font-display text-2xl text-foreground">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        {meta && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            {meta}
          </div>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
