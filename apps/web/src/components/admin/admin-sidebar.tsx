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
 * Admin sidebar shell (client) — owns the desktop collapse state. The collapse control is a
 * full-width button in the footer styled like a nav item, so it clearly sits on the rail and
 * is easy to hit (the old floating corner button read as detached from the menu). Collapse is
 * a desktop (lg) affordance; on mobile the sidebar is a full-width top bar and always expanded.
 * The theme toggle now lives fixed at the screen's top-right (see the admin layout).
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
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/admin"
          aria-label="BeeCompete Admin"
          className={cn('flex items-center gap-2', collapsed && 'lg:justify-center')}
        >
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
        {/* Mobile top bar gets the theme toggle inline (the fixed top-right one is desktop-only,
            where it would collide with this bar). */}
        <div className="lg:hidden">
          <ThemeToggle />
        </div>
      </div>

      <AdminNav collapsed={collapsed} />

      {/* Collapse control — desktop only (the mobile top bar has no width to reclaim). Styled
          like a nav item + pinned to the bottom so it clearly belongs to the rail. */}
      <button
        type="button"
        onClick={toggle}
        aria-pressed={collapsed}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cn(
          'mt-auto hidden items-center gap-2.5 rounded-lg py-2 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-foreground lg:flex',
          collapsed ? 'justify-center px-2' : 'px-3',
        )}
      >
        {collapsed ? (
          <ChevronRight aria-hidden="true" className="size-4.5 shrink-0" />
        ) : (
          <ChevronLeft aria-hidden="true" className="size-4.5 shrink-0" />
        )}
        {!collapsed && 'Collapse'}
      </button>
    </aside>
  );
}
