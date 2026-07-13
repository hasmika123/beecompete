'use client';

import { useCallback, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Logo, ThemeToggle, cn } from '@beecompete/ui';
import { AdminNav } from './admin-nav';

const STORAGE_KEY = 'admin:sidebar-collapsed';
const CHANGE_EVENT = 'admin:sidebar-collapse-change';

function subscribe(onChange: () => void) {
  // `storage` keeps other tabs in sync; the custom event fires this-tab toggles.
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/**
 * Persisted collapse state via useSyncExternalStore — reads localStorage as the client
 * snapshot and `false` (expanded) as the server snapshot, so there's no hydration mismatch
 * and no setState-in-effect. Toggling writes localStorage and dispatches the change event.
 */
function useSidebarCollapsed(): [boolean, () => void] {
  const collapsed = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(STORAGE_KEY) === 'true',
    () => false,
  );
  const toggle = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, String(localStorage.getItem(STORAGE_KEY) !== 'true'));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return [collapsed, toggle];
}

/**
 * Admin sidebar shell (client) — owns the desktop collapse state and gives the theme
 * toggle a dedicated, un-squished footer row (it previously shared the logo line and got
 * crammed into the corner of the narrow rail). Collapse is a desktop (lg) affordance;
 * on mobile the sidebar is a full-width top bar and always shows labels.
 */
export function AdminSidebar() {
  const [collapsed, toggle] = useSidebarCollapsed();

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col gap-6 border-b border-border p-4 lg:border-r lg:border-b-0',
        collapsed ? 'lg:w-[4.75rem] lg:p-3' : 'lg:w-60',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2',
          collapsed ? 'lg:justify-center' : 'justify-between',
        )}
      >
        <Link href="/admin" className="flex items-center gap-2" aria-label="BeeCompete Admin">
          {/* Collapsed: the wordmark won't fit the rail, so show just the gold brand mark. */}
          {collapsed ? (
            <span
              aria-hidden="true"
              className="hidden size-3 rounded-full bg-brand-gold lg:inline-block"
            />
          ) : null}
          <span className={cn('flex items-center gap-2', collapsed && 'lg:hidden')}>
            <Logo />
            <span className="rounded bg-surface px-1.5 py-0.5 text-xs font-semibold text-muted">
              Admin
            </span>
          </span>
        </Link>
        {/* Collapse control — desktop only (the mobile top bar has no width to reclaim). */}
        <button
          type="button"
          onClick={toggle}
          aria-pressed={collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground lg:inline-flex"
        >
          {collapsed ? (
            <ChevronRight aria-hidden="true" className="size-4.5" />
          ) : (
            <ChevronLeft aria-hidden="true" className="size-4.5" />
          )}
        </button>
      </div>

      <AdminNav collapsed={collapsed} />

      {/* Footer — pushed to the bottom on the tall desktop rail; gives the theme toggle
          room to breathe instead of sharing the logo line. */}
      <div
        className={cn(
          'mt-auto flex items-center border-t border-border pt-4',
          collapsed ? 'lg:justify-center' : 'gap-2',
        )}
      >
        <ThemeToggle />
        {!collapsed && <span className="text-sm text-muted">Theme</span>}
      </div>
    </aside>
  );
}
