'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';

/**
 * TODO(F7): replace with the shared IconButton + Lucide icon from @beecompete/ui.
 *
 * Minimal local placeholder — packages/ui has no primitives yet (F7). Kept tiny and
 * self-contained on purpose; the one deliberate exception to the "all shared UI from
 * packages/ui" rule during the skeleton phase (approved for F3).
 */

const noopSubscribe = () => () => {};

/**
 * True once mounted on the client, false during SSR — without a setState-in-effect.
 * The theme is unknown on the server, so we render a stable placeholder until mounted
 * to avoid a hydration mismatch.
 */
function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={mounted ? `Switch to ${isDark ? 'light' : 'dark'} mode` : 'Toggle color theme'}
      className="inline-flex h-9 min-w-9 items-center justify-center rounded-xl border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-gold"
    >
      <span suppressHydrationWarning>{mounted ? (isDark ? 'Light' : 'Dark') : '·'}</span>
    </button>
  );
}
