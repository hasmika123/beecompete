'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Buildings, Dashboard, ImageSquare, Tag, Tray, Trophy, cn } from '@beecompete/ui';

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: Dashboard, exact: true },
  { href: '/admin/competitions', label: 'Competitions', icon: Trophy },
  { href: '/admin/organizations', label: 'Organizations', icon: Buildings },
  { href: '/admin/categories', label: 'Categories', icon: Tag },
  { href: '/admin/import-records', label: 'Import queue', icon: Tray },
  { href: '/admin/landing', label: 'Landing content', icon: ImageSquare },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-surface text-foreground'
                : 'text-muted hover:bg-surface/60 hover:text-foreground',
            )}
          >
            <Icon
              aria-hidden="true"
              weight={active ? 'fill' : 'regular'}
              className="size-4.5 shrink-0"
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
