import Link from 'next/link';
import { cn } from '@beecompete/ui';
import type { HeroCardView } from '@/lib/catalog-types';

// Hero right half (decision #25): one main HeroCard (a link — hover/focus shows a translucent
// WCAG-AA scrim with a short destination description) + two image-only satellites hovering
// top-right and bottom-left, entering with a staggered rise (blueprint motion note). All three
// are admin-managed (M36); gradient placeholders render until the owner supplies images
// (image upload itself is deferred to PR C — an imageKey that's a full URL renders as-is).

function heroSrc(card: HeroCardView | undefined): string | null {
  return card && /^https?:\/\//.test(card.imageKey) ? card.imageKey : null;
}

function CardImage({
  card,
  placeholderClass,
  className,
}: {
  card: HeroCardView | undefined;
  placeholderClass: string;
  className?: string;
}) {
  const src = heroSrc(card);
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- admin-supplied remote image; next/image needs a known host list (R1-10)
    <img src={src} alt={card?.altText ?? ''} className={cn('size-full object-cover', className)} />
  ) : (
    <div
      aria-hidden="true"
      className={cn('size-full bg-linear-to-br', placeholderClass, className)}
    />
  );
}

export function HeroCards({ cards }: { cards: HeroCardView[] }) {
  const main = cards.find((c) => c.position === 'main');
  const topRight = cards.find((c) => c.position === 'top_right');
  const bottomLeft = cards.find((c) => c.position === 'bottom_left');
  const mainInner = (
    <>
      <CardImage
        card={main}
        placeholderClass="from-brand-gold-soft via-amber-100 to-brand-gold/50 dark:from-stone-800 dark:via-amber-900/40 dark:to-brand-gold/30"
      />
      {main?.linkUrl && (
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-black/60 p-6 text-center',
            'text-lg font-medium text-white opacity-0 transition-opacity duration-200',
            'group-hover/hero:opacity-100 group-focus-visible/hero:opacity-100',
          )}
        >
          {main.description ?? 'Browse competitions'}
        </span>
      )}
    </>
  );

  return (
    <div className="relative mx-6 my-4 sm:mx-10" aria-label="Featured imagery">
      {/* Main card */}
      {main?.linkUrl ? (
        <Link
          href={main.linkUrl}
          aria-label={main.description ?? main.altText}
          className={cn(
            'group/hero relative block aspect-[4/3] overflow-hidden rounded-[var(--radius-panel)]',
            'border border-border shadow-[var(--shadow-lift)]',
          )}
        >
          {mainInner}
        </Link>
      ) : (
        <div className="group/hero relative block aspect-[4/3] overflow-hidden rounded-[var(--radius-panel)] border border-border shadow-[var(--shadow-lift)]">
          {mainInner}
        </div>
      )}

      {/* Satellites — image-only, staggered entrance. */}
      <div
        aria-hidden="true"
        className="absolute -top-6 -right-6 h-24 w-32 animate-rise-in overflow-hidden rounded-[var(--radius-panel)] border border-border shadow-[var(--shadow-lift)] [animation-delay:200ms] sm:h-28 sm:w-40"
      >
        <CardImage
          card={topRight}
          placeholderClass="from-sky-100 to-blue-300/70 dark:from-sky-950 dark:to-blue-800/60"
        />
      </div>
      <div
        aria-hidden="true"
        className="absolute -bottom-6 -left-6 h-24 w-32 animate-rise-in overflow-hidden rounded-[var(--radius-panel)] border border-border shadow-[var(--shadow-lift)] [animation-delay:400ms] sm:h-28 sm:w-40"
      >
        <CardImage
          card={bottomLeft}
          placeholderClass="from-emerald-100 to-teal-300/70 dark:from-emerald-950 dark:to-teal-800/60"
        />
      </div>
    </div>
  );
}
