import type { ComponentType } from 'react';
import {
  Bank,
  Brain,
  Briefcase,
  Code,
  Flask,
  MathOperations,
  Microphone,
  MusicNotes,
  PenNib,
  Robot,
  Sparkles,
} from '../icons';
import { cn } from '../lib/cn';

/**
 * Per-category accent hues + generated default cover art (blueprints decision #15; R1-6).
 * Each of the 11 launch categories gets an assigned hue used in its generated cover
 * (soft tint gradient + duotone icon) and its tinted card meta tag — keeps card grids
 * scannable and reinforces cross-subject breadth. Hues are builder judgment (delegation
 * 2026-07-12): soft tints on the warm ground, AA-safe text tones, dark-mode variants.
 *
 * Real per-competition cover art overrides the generated cover when a listing has it
 * (asset pipeline arrives with the S3 upload work — PR C).
 */
export interface CategoryArt {
  /** Phosphor icon rendered in covers, tiles, and the hero category strip. */
  icon: ComponentType<{ className?: string; weight?: 'regular' | 'bold' | 'fill' | 'duotone' }>;
  /** Gradient classes for the generated cover ground. */
  cover: string;
  /** Icon tone on the generated cover. */
  coverIcon: string;
  /** Tinted meta-tag (category badge) classes. */
  tag: string;
}

const OTHER: CategoryArt = {
  icon: Sparkles,
  cover: 'from-stone-100 to-stone-300/70 dark:from-stone-900 dark:to-stone-700/70',
  coverIcon: 'text-stone-500 dark:text-stone-300',
  tag: 'bg-stone-100 text-stone-800 dark:bg-stone-800/60 dark:text-stone-200',
};

const ART: Record<string, CategoryArt> = {
  math: {
    icon: MathOperations,
    cover: 'from-blue-100 to-blue-300/70 dark:from-blue-950 dark:to-blue-800/70',
    coverIcon: 'text-blue-600 dark:text-blue-300',
    tag: 'bg-blue-100 text-blue-900 dark:bg-blue-900/60 dark:text-blue-200',
  },
  'science-engineering': {
    icon: Flask,
    cover: 'from-emerald-100 to-emerald-300/70 dark:from-emerald-950 dark:to-emerald-800/70',
    coverIcon: 'text-emerald-600 dark:text-emerald-300',
    tag: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-200',
  },
  'computer-science': {
    icon: Code,
    cover: 'from-violet-100 to-violet-300/70 dark:from-violet-950 dark:to-violet-800/70',
    coverIcon: 'text-violet-600 dark:text-violet-300',
    tag: 'bg-violet-100 text-violet-900 dark:bg-violet-900/60 dark:text-violet-200',
  },
  robotics: {
    icon: Robot,
    cover: 'from-orange-100 to-orange-300/70 dark:from-orange-950 dark:to-orange-800/70',
    coverIcon: 'text-orange-600 dark:text-orange-300',
    tag: 'bg-orange-100 text-orange-900 dark:bg-orange-900/60 dark:text-orange-200',
  },
  'debate-speech': {
    icon: Microphone,
    cover: 'from-rose-100 to-rose-300/70 dark:from-rose-950 dark:to-rose-800/70',
    coverIcon: 'text-rose-600 dark:text-rose-300',
    tag: 'bg-rose-100 text-rose-900 dark:bg-rose-900/60 dark:text-rose-200',
  },
  'business-entrepreneurship': {
    icon: Briefcase,
    cover: 'from-teal-100 to-teal-300/70 dark:from-teal-950 dark:to-teal-800/70',
    coverIcon: 'text-teal-600 dark:text-teal-300',
    tag: 'bg-teal-100 text-teal-900 dark:bg-teal-900/60 dark:text-teal-200',
  },
  'writing-essay': {
    icon: PenNib,
    cover: 'from-indigo-100 to-indigo-300/70 dark:from-indigo-950 dark:to-indigo-800/70',
    coverIcon: 'text-indigo-600 dark:text-indigo-300',
    tag: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900/60 dark:text-indigo-200',
  },
  'arts-music': {
    icon: MusicNotes,
    cover: 'from-fuchsia-100 to-fuchsia-300/70 dark:from-fuchsia-950 dark:to-fuchsia-800/70',
    coverIcon: 'text-fuchsia-600 dark:text-fuchsia-300',
    tag: 'bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-900/60 dark:text-fuchsia-200',
  },
  'academic-bowl': {
    icon: Brain,
    cover: 'from-amber-100 to-amber-300/70 dark:from-amber-950 dark:to-amber-800/70',
    coverIcon: 'text-amber-600 dark:text-amber-300',
    tag: 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200',
  },
  'history-geography-civics': {
    icon: Bank,
    cover: 'from-sky-100 to-sky-300/70 dark:from-sky-950 dark:to-sky-800/70',
    coverIcon: 'text-sky-600 dark:text-sky-300',
    tag: 'bg-sky-100 text-sky-900 dark:bg-sky-900/60 dark:text-sky-200',
  },
  other: OTHER,
};

/** Art for a category slug; unknown slugs get the neutral "other" treatment. */
export function categoryArt(slug: string): CategoryArt {
  return ART[slug] ?? OTHER;
}

/** The generated default cover (decision #6/#15): tint gradient + centered duotone icon. */
export function CategoryCover({
  slug,
  className,
  iconClassName,
}: {
  slug: string;
  className?: string;
  iconClassName?: string;
}) {
  const art = categoryArt(slug);
  const Icon = art.icon;
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative flex items-center justify-center bg-linear-to-br',
        art.cover,
        className,
      )}
    >
      <Icon
        weight="duotone"
        className={cn(
          'size-14 transition-transform group-hover:scale-105',
          art.coverIcon,
          iconClassName,
        )}
      />
    </div>
  );
}

/** The tinted category meta tag (decision #15) — a Badge in the category's accent hue. */
export function CategoryTag({
  slug,
  name,
  className,
}: {
  slug: string;
  name: string;
  className?: string;
}) {
  const art = categoryArt(slug);
  const Icon = art.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        art.tag,
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {name}
    </span>
  );
}
