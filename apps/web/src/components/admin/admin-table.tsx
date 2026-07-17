import type { ReactNode } from 'react';
import { EmptyState } from '@beecompete/ui';

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  /** Right-align (numbers, actions). */
  align?: 'left' | 'right';
  className?: string;
}

/**
 * Server-rendered admin data table — display only (sorting/paging via URL params on the page).
 * Horizontally scrolls on narrow screens; empty state when there are no rows.
 */
export function AdminTable<T>({
  columns,
  rows,
  rowKey,
  empty = 'Nothing here yet.',
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** A bare title, or a full empty state with optional description + action. */
  empty?: string | { title: ReactNode; description?: ReactNode; action?: ReactNode };
}) {
  if (rows.length === 0) {
    // EmptyState draws its own dashed border — render it directly (no double border).
    const e = typeof empty === 'string' ? { title: empty } : empty;
    return <EmptyState title={e.title} description={e.description} action={e.action} />;
  }

  return (
    <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface/50 text-left">
            {columns.map((col, i) => (
              <th
                key={i}
                scope="col"
                className={`px-4 py-2.5 font-medium text-muted ${col.align === 'right' ? 'text-right' : ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-border last:border-0 hover:bg-surface/40"
            >
              {columns.map((col, i) => (
                <td
                  key={i}
                  className={`px-4 py-2.5 align-middle text-foreground ${col.align === 'right' ? 'text-right' : ''} ${col.className ?? ''}`}
                >
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
