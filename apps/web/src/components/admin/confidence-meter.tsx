import { cn } from '@beecompete/ui';

/**
 * The pipeline's self-scored extraction confidence (0–1), as a bar plus the number.
 *
 * A bare "0.42" in a table column is a number nobody ranks against anything; the bar makes a page
 * of records sortable by eye, which is the whole point of showing it at review time. Colour bands
 * are advisory — confidence is the extractor's own opinion, not a verdict, so a low score means
 * "read this one closely", never "reject it".
 */
export function ConfidenceMeter({
  value,
  className,
}: {
  /** null for records that were never scored — public Request-a-Competition submissions. */
  value: number | null;
  className?: string;
}) {
  if (value === null) {
    return <span className={cn('text-xs text-muted', className)}>unscored</span>;
  }
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const tone =
    pct >= 75 ? 'bg-success' : pct >= 50 ? 'bg-brand-gold' : 'bg-amber-500 dark:bg-amber-400';
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span
        role="img"
        aria-label={`extraction confidence ${pct}%`}
        className="h-1.5 w-14 overflow-hidden rounded-full bg-border"
      >
        <span className={cn('block h-full rounded-full', tone)} style={{ width: `${pct}%` }} />
      </span>
      <span className="text-xs tabular-nums text-muted">{value.toFixed(2)}</span>
    </span>
  );
}
