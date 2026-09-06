import Link from 'next/link';
import { Plus, cn } from '@beecompete/ui';
import { seasonStatusLabel } from '@/components/admin/enum-labels';
import type { Edition } from '@/lib/admin-types';

/**
 * Which season the listing page's form is editing, and one click to any other (2026-09-05).
 *
 * A row of pill links, newest first, each carrying the season's run status; the selected one is
 * filled, and "New season" is a dashed pill at the end. Every pill is the SAME page with a
 * `?season=` param, so an older season opens in exactly the form the current one does — the old
 * per-season page with its own field layout is gone. Links rather than buttons because the
 * choice is a navigation: the URL names the season, and a reload or a shared link keeps it.
 */
export function SeasonSwitcher({
  competitionId,
  seasons,
  selectedId,
  adding,
}: {
  competitionId: string;
  seasons: Edition[];
  /** The season on the page, or null while adding one. */
  selectedId: string | null;
  adding: boolean;
}) {
  const href = (season: string) => `/admin/competitions/${competitionId}?season=${season}`;
  const sorted = [...seasons].sort((a, b) =>
    b.cycleLabel.localeCompare(a.cycleLabel, 'en', { numeric: true }),
  );
  const pill =
    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

  return (
    <nav aria-label="Seasons" className="mb-6 flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-semibold tracking-wide text-muted uppercase">Season</span>
      {sorted.map((s) => {
        const selected = !adding && s.id === selectedId;
        return (
          <Link
            key={s.id}
            href={href(s.id)}
            aria-current={selected ? 'page' : undefined}
            className={cn(
              pill,
              selected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-surface-raised text-foreground hover:border-muted/50',
            )}
          >
            {s.cycleLabel}
            <span
              className={cn(
                'text-xs font-normal',
                selected ? 'text-primary-foreground/70' : 'text-muted',
              )}
            >
              {s.archivedAt ? 'Archived' : seasonStatusLabel(s.status)}
            </span>
          </Link>
        );
      })}
      <Link
        href={href('new')}
        aria-current={adding ? 'page' : undefined}
        className={cn(
          pill,
          'gap-1',
          adding
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-dashed border-border text-muted hover:border-muted/50 hover:text-foreground',
        )}
      >
        <Plus aria-hidden="true" className="size-3.5" /> New season
      </Link>
    </nav>
  );
}
