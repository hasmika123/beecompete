import { cn } from '../lib/cn';

/**
 * Placeholder wordmark — display serif + gold accent dot (gold is fill/accent only,
 * never text — design-brief §4). Swapped in place when the owner supplies final
 * logo art (light + dark variants live here, architecture §8).
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'font-display inline-flex items-center gap-1.5 text-2xl tracking-tight text-foreground',
        className,
      )}
    >
      BeeCompete
      <span aria-hidden="true" className="mt-1 inline-block size-2 rounded-full bg-brand-gold" />
    </span>
  );
}
