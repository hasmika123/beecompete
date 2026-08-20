'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@beecompete/ui';

/**
 * The detail page's right rail (#85): scrolls with the page, then pins when its BOTTOM edge
 * reaches the viewport bottom — so a rail taller than the screen is fully readable instead of
 * having its tail (Timeline, Trust panel) cut off forever, which is what the old fixed
 * `lg:top-24` top-pin did.
 *
 * Same measured technique as the marketplace filter panel (marketplace-frame.tsx — the sticky
 * `top` must know the element's height, which CSS alone cannot express): sticky top =
 * 100dvh − height − 24px. A rail SHORTER than the viewport keeps the classic top-24 pin — for it,
 * bottom-pinning is meaningless (it would hover mid-screen) and the old behaviour was right.
 * ResizeObserver keeps the measurement fresh (the Timeline/capture panels change height on
 * submit); measured synchronously at mount first, since the observer's initial delivery rides a
 * frame loop that backgrounded tabs starve.
 *
 * Height cap deliberately absent: the rail must NOT get `max-h` + internal scroll — same owner
 * rule as the filter panel ("no internal scroll: the panel sits in normal flow and the PAGE
 * grows").
 *
 * `className` exists so the detail page can hand this `max-lg:contents` (mobile pass): below lg
 * the rail is not a column at all, it is dissolved so its panels can be interleaved with the main
 * column's by `order`. See the layout note on the page's grid. The measuring effect is inert in
 * that state — a `display:contents` element has no box, so `offsetHeight` is 0, `fits` is true and
 * the inline `top` it writes is simply never consulted (nothing is sticky below lg). The window
 * `resize` listener re-measures on the way back up to a real rail, which is what keeps the
 * bottom-pin correct after a rotate or a window drag across the breakpoint.
 */
export function StickyRail({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const h = el.offsetHeight;
      // 96px = the old lg:top-24 (breadcrumb/header clearance); 24px bottom breathing room.
      const fits = h <= window.innerHeight - 96 - 24;
      el.style.top = fits ? '6rem' : `calc(100dvh - ${h}px - 24px)`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  return (
    <aside ref={ref} className={cn('lg:sticky lg:self-start', className)}>
      {children}
    </aside>
  );
}
