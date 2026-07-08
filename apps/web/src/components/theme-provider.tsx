'use client';

import { ThemeProvider as NextThemeProvider } from 'next-themes';
import type { ComponentProps } from 'react';

/**
 * App-wide theme context (light/dark) via next-themes, class strategy.
 *
 * F3 skeleton wiring. The toggle UI is a local placeholder (see theme-toggle.tsx,
 * TODO F7); the provider itself is permanent infrastructure.
 */
export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemeProvider>) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemeProvider>
  );
}
