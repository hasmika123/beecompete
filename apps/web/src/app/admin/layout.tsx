import type { Metadata } from 'next';
import { ToastProvider } from '@beecompete/ui';
import { AdminSidebar } from '@/components/admin/admin-sidebar';

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
        <AdminSidebar />
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
