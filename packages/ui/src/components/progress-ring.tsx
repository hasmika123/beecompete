import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * ProgressRing — a compact circular progress donut. Used for the admin create-competition
 * completion indicator (required fields across the whole form), but generic: pass value/max
 * and any center content. The arc reads gold while in progress and success-green once complete,
 * so "done" is legible without relying on the number alone.
 */

export interface ProgressRingProps {
  value: number;
  max: number;
  /** Diameter in px (default 64). */
  size?: number;
  /** Stroke width in px (default 6). */
  thickness?: number;
  /** Center content (e.g. "3/4" or a check). */
  children?: ReactNode;
  /** Accessible label — the ring is a progressbar; the visible number is aria-hidden. */
  label?: string;
  className?: string;
}

export function ProgressRing({
  value,
  max,
  size = 64,
  thickness = 6,
  children,
  label,
  className,
}: ProgressRingProps) {
  const safeMax = Math.max(1, max);
  const clamped = Math.min(Math.max(value, 0), safeMax);
  const complete = clamped >= safeMax;
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamped / safeMax);

  return (
    <div
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-label={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className="[stroke:var(--border)]"
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          className={cn(
            'transition-[stroke-dashoffset] duration-500 ease-out',
            complete ? '[stroke:var(--success)]' : '[stroke:var(--brand-gold)]',
          )}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
        {children}
      </span>
    </div>
  );
}
