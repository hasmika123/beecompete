'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@beecompete/ui';

/**
 * The competition description, under the organizer byline (owner 2026-08-18, #106) — clamped to
 * TWO lines with the toggle sitting at the END of the second line (#107), not on a line of its
 * own.
 *
 * The FULL text is always in the DOM — the clamp is purely visual (`line-clamp`), never a
 * substring. That matters twice: this page is the primary SEO surface (crawlers must see the
 * whole description), and expanding must not re-fetch or re-layout anything.
 *
 * How the inline toggle works: `-webkit-line-clamp` renders its own ellipsis at the truncation
 * point but gives no way to put content beside it, so the collapsed button is absolutely
 * positioned at the box's bottom-right and carries a left-to-right gradient of the PAGE GROUND
 * (`--background`, which is what sits behind this text — verified) so the clipped tail fades out
 * underneath it instead of colliding with the label. ⚠ If this block ever moves onto a card, that
 * gradient must switch to the card's fill or a hard edge appears.
 */
export function DescriptionExcerpt({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clipped, setClipped] = useState(false);

  useEffect(() => {
    const el = ref.current;
    // Measure ONLY while clamped: once expanded, scrollHeight === clientHeight and the check
    // would flip `clipped` false, deleting the "See less" button mid-read. Skipping the effect
    // in that state leaves the last measurement standing.
    if (!el || expanded) return;
    const measure = () => setClipped(el.scrollHeight > el.clientHeight + 1);
    measure();
    // Width changes (rotate, resize) change how many lines the text needs.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded, text]);

  const toggle = () => setExpanded((v) => !v);
  const focusRing =
    'rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

  return (
    // max-w-prose lives on the WRAPPER, not the <p>: the collapsed button anchors to this box's
    // right edge, which therefore has to be the text's right edge.
    <div className="relative mt-3 max-w-prose">
      <p
        ref={ref}
        className={cn(
          'text-sm leading-relaxed whitespace-pre-line text-foreground',
          !expanded && 'line-clamp-2',
        )}
      >
        {text}
      </p>
      {clipped &&
        (expanded ? (
          <button
            type="button"
            onClick={toggle}
            aria-expanded
            className={cn(
              'mt-1 text-sm font-medium text-muted underline underline-offset-2 hover:text-foreground',
              focusRing,
            )}
          >
            See less
          </button>
        ) : (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={false}
            className={cn(
              'absolute right-0 bottom-0 pl-8 text-sm font-medium text-muted underline underline-offset-2 hover:text-foreground',
              // Fades the clipped tail into the page ground over the button's left padding.
              'bg-[linear-gradient(to_right,transparent,var(--background)_2rem)]',
              focusRing,
            )}
          >
            {/* Decorative: line-clamp's own ellipsis is masked by this button, so the button
                supplies the "…" that makes the cut-off read as a cut-off. */}
            <span aria-hidden="true">…&nbsp;</span>
            See more
          </button>
        ))}
    </div>
  );
}
