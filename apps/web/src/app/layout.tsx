import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from '@/components/theme-provider';
import { SITE_URL } from '@/lib/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'BeeCompete',
    template: '%s · BeeCompete',
  },
  description: 'BeeCompete — a marketplace for K-12 academic competitions. (Skeleton build.)',
  // No public indexing until the R1 launch gate.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f5' },
    { media: '(prefers-color-scheme: dark)', color: '#262624' },
  ],
};

// Root layout is intentionally minimal — just <html>/<body>/theme. Section chrome lives in the
// nested layouts: (public) carries the SiteHeader/Footer; admin carries its own shell.
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: next-themes sets the class/style on <html> before
    // React hydrates, which would otherwise trip a mismatch warning.
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
