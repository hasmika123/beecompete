'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Button } from './button';

/**
 * Light/dark toggle (moved from apps/web — resolves its TODO(F7)). Ghost icon
 * button; renders a stable placeholder until mounted to avoid a hydration
 * mismatch (theme is unknown during SSR).
 */

const noopSubscribe = () => () => {};

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
    <Button
      variant="ghost"
      size="sm"
      className="size-9 px-0"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={mounted ? `Switch to ${isDark ? 'light' : 'dark'} mode` : 'Toggle color theme'}
    >
      <span suppressHydrationWarning>
        {mounted ? (
          isDark ? (
            <Sun aria-hidden="true" />
          ) : (
            <Moon aria-hidden="true" />
          )
        ) : (
          <span className="inline-block size-4" />
        )}
      </span>
    </Button>
  );
}
