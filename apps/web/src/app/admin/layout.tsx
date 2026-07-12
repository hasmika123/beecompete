import type { Metadata } from 'next';
import Link from 'next/link';
import { Logo, ThemeToggle, ToastProvider } from '@beecompete/ui';
import { AdminNav } from '@/components/admin/admin-nav';

// Admin is never indexed and gated by Cloudflare Access in production (email allow-list).
export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Admin · BeeCompete' },
  robots: { index: false, follow: false },
};

/**
 * Admin shell — its own chrome (sidebar + topbar), distinct from the public site. Internal
 * curation tool (R1-3); styling is builder judgment on the design tokens (design-brief §1).
 */
export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ToastProvider>
      <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
        <aside className="flex shrink-0 flex-col gap-6 border-b border-border p-4 lg:w-60 lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between">
            <Link href="/admin" className="flex items-center gap-2">
              <Logo />
              <span className="rounded bg-surface px-1.5 py-0.5 text-xs font-semibold text-muted">
                Admin
              </span>
            </Link>
            <ThemeToggle />
          </div>
          <AdminNav />
        </aside>
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
