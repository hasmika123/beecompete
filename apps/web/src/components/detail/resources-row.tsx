import type { ComponentType } from 'react';
import {
  Article,
  BookOpen,
  ExternalLink,
  FilePdf,
  Info,
  LinkIcon,
  PlayCircle,
  cn,
} from '@beecompete/ui';
import { ScrollRow } from '@/components/scroll-row';
import { resourceTypeLabel } from '@/lib/detail-display';
import type { ResourceView } from '@/lib/catalog-types';

// Resources section (blueprints Page 3.3b, → M11) + affiliate disclosure (🔒 DQ10, R1-8). A
// horizontally scrollable row of resource cards; affiliate links carry rel="sponsored nofollow"
// and are marked individually with an "Affiliate" chip, and a clear, conspicuous disclosure
// renders WITH the row whenever any affiliate link is present (FTC endorsement rule — the
// dedicated disclosure page lands with R1-12). Non-affiliate outbound links stay nofollow too;
// we link to third parties factually and vouch for none (nominative use, compliance §8).

type IconType = ComponentType<{
  className?: string;
  weight?: 'regular' | 'bold' | 'fill' | 'duotone';
}>;

const TYPE_ICON: Record<string, IconType> = {
  book: BookOpen,
  past_paper: FilePdf,
  guide: Article,
  video: PlayCircle,
  other: LinkIcon,
};

// Soft tint per type so the row scans without real preview art (owner delegation #29).
const TYPE_TINT: Record<string, string> = {
  book: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300',
  past_paper: 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-300',
  guide: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300',
  video: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-300',
  other: 'bg-surface text-muted',
};

function ResourceCard({ resource }: { resource: ResourceView }) {
  const Icon = TYPE_ICON[resource.type] ?? LinkIcon;
  const tint = TYPE_TINT[resource.type] ?? TYPE_TINT.other;
  const rel = resource.isAffiliate
    ? 'sponsored nofollow noopener noreferrer'
    : 'nofollow noopener noreferrer';
  return (
    <a
      role="listitem"
      href={resource.url}
      target="_blank"
      rel={rel}
      className={cn(
        'group/res flex w-56 shrink-0 snap-start flex-col overflow-hidden rounded-[var(--radius-panel)]',
        'border border-border bg-surface-raised transition-colors hover:border-muted/50',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
      )}
    >
      <div className={cn('flex h-24 items-center justify-center', tint)}>
        <Icon aria-hidden="true" weight="duotone" className="size-9" />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted">{resourceTypeLabel(resource.type)}</span>
          {resource.isAffiliate && (
            <span className="rounded-full bg-brand-gold-soft px-1.5 py-0.5 text-[10px] font-medium text-foreground">
              Affiliate
            </span>
          )}
        </div>
        <p className="line-clamp-2 text-sm font-medium text-foreground">{resource.title}</p>
        <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs text-muted group-hover/res:text-foreground">
          Open <ExternalLink aria-hidden="true" className="size-3" />
        </span>
      </div>
    </a>
  );
}

export function ResourcesRow({ resources }: { resources: ResourceView[] }) {
  if (resources.length === 0) return null;
  const hasAffiliate = resources.some((r) => r.isAffiliate);

  return (
    <section aria-labelledby="resources-heading" className="grid gap-3">
      <h2 id="resources-heading" className="font-display text-xl text-foreground">
        Prep resources
      </h2>

      {hasAffiliate && (
        <p className="flex items-start gap-2 rounded-[var(--radius-field)] bg-surface px-3 py-2 text-xs leading-relaxed text-muted">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            Some links below are{' '}
            <strong className="font-medium text-foreground">affiliate links</strong>. If you buy
            through them, BeeCompete may earn a small commission at no extra cost to you — it never
            affects what we list or how we rank it.
          </span>
        </p>
      )}

      <ScrollRow label="Prep resources">
        {resources.map((resource) => (
          <ResourceCard key={resource.id} resource={resource} />
        ))}
      </ScrollRow>
    </section>
  );
}
