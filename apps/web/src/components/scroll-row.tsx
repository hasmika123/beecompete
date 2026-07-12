'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, ChevronLeft, ChevronRight, cn } from '@beecompete/ui';

// Shared horizontal scroll row with side arrow buttons — the hero category strip and the
// Featured carousel (Page 1). USER-DRIVEN ONLY: no auto-advance (carousel rule, decision #8);
// the next item peeks at the edge via padding so scrollability is obvious.
export function ScrollRow({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState({ left: false, right: false });

  const update = () => {
    const el = ref.current;
    if (!el) return;
    setCanScroll({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  };

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scrollBy = (direction: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <div className={cn('group/row relative', className)}>
      <div
        ref={ref}
        role="list"
        aria-label={label}
        onScroll={update}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pr-10 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {canScroll.left && (
        <Button
          variant="secondary"
          size="sm"
          aria-label="Scroll left"
          onClick={() => scrollBy(-1)}
          className="absolute top-1/2 left-0 z-10 -translate-y-1/2 shadow-[var(--shadow-popover)]"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </Button>
      )}
      {canScroll.right && (
        <Button
          variant="secondary"
          size="sm"
          aria-label="Scroll right"
          onClick={() => scrollBy(1)}
          className="absolute top-1/2 right-0 z-10 -translate-y-1/2 shadow-[var(--shadow-popover)]"
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      )}
    </div>
  );
}
