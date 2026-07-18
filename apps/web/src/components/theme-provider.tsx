'use client';

import { ThemeProvider as NextThemeProvider } from 'next-themes';
import type { ComponentProps } from 'react';

/**
 * App-wide theme context (light/dark) via next-themes, class strategy.
 *
 * LIGHT IS THE DEFAULT, deliberately (owner 2026-07-18): a first-time visitor gets light
 * regardless of their OS/browser `prefers-color-scheme`, so the marketing surface always makes its
 * first impression in the palette it was designed and reviewed in. `enableSystem={false}` is what
 * severs the OS link — without it next-themes would still resolve "system" for new visitors.
 *
 * Dark mode is NOT gone: the ThemeToggle still switches it and next-themes persists that choice in
 * localStorage, so a returning visitor keeps whatever they picked. Only the unset default changed.
 */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemeProvider>) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemeProvider>
  );
}
