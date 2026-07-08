/**
 * TODO(F7): replace with the real logo/wordmark asset from @beecompete/ui
 * (light + dark variants + favicon live there — architecture §8, design-brief §6).
 *
 * Placeholder text wordmark for the F3 skeleton — no final art yet. Uses ink text
 * with a gold accent dot (gold is fill/accent only, never text — design-brief §4).
 */
export function Logo() {
  return (
    <span className="inline-flex items-center gap-1.5 text-lg font-extrabold tracking-tight text-foreground">
      BeeCompete
      <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-brand-gold" />
    </span>
  );
}
