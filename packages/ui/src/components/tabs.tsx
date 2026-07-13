'use client';

import { createContext, useContext, useId, useRef, useState } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * Tabs — Details page Overview/Resources/FAQ (R1-7), admin. Roving-tabindex keyboard
 * model (←/→/Home/End), one panel visible at a time. Controlled via `value` or
 * self-managed with `defaultValue`.
 *
 * Two looks (`variant`):
 *  - `underline` (default): quiet tab strip with an active underline.
 *  - `attached` (owner reference 2026-07-08): the active tab is a filled riser that
 *    connects seamlessly into a filled content card below it (a "folder tab").
 */

export type TabsVariant = 'underline' | 'attached';

interface TabsContextValue {
  value: string;
  setValue: (v: string) => void;
  baseId: string;
  variant: TabsVariant;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs(component: string): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error(`<${component}> must be used inside <Tabs>`);
  return ctx;
}

// Concave "folder-tab" fillets: two pseudo-elements just outside the active tab's
// bottom corners, each a quarter-circle of the panel color that curves the tab's
// vertical side smoothly into the card's top edge (radius must match the card fill).
const ATTACHED_FILLET =
  "before:absolute before:bottom-0 before:left-[-14px] before:size-[14px] before:content-[''] " +
  'before:bg-[radial-gradient(circle_at_top_left,transparent_13.5px,var(--surface)_14px)] ' +
  "after:absolute after:bottom-0 after:right-[-14px] after:size-[14px] after:content-[''] " +
  'after:bg-[radial-gradient(circle_at_top_right,transparent_13.5px,var(--surface)_14px)]';

export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value?: string;
  defaultValue: string;
  onValueChange?: (value: string) => void;
  variant?: TabsVariant;
}

export function Tabs({
  value: controlled,
  defaultValue,
  onValueChange,
  variant = 'underline',
  className,
  children,
  ...props
}: TabsProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const value = controlled ?? uncontrolled;
  const baseId = useId();

  const setValue = (v: string) => {
    if (controlled === undefined) setUncontrolled(v);
    onValueChange?.(v);
  };

  return (
    <TabsContext.Provider value={{ value, setValue, baseId, variant }}>
      <div className={className} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabList({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { variant } = useTabs('TabList');
  const ref = useRef<HTMLDivElement>(null);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const tabs = Array.from(
      ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])') ?? [],
    );
    const current = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) return;
    e.preventDefault();
    let next = current;
    if (e.key === 'ArrowRight') next = (current + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    tabs[next]?.focus();
    tabs[next]?.click();
  };

  return (
    <div
      ref={ref}
      role="tablist"
      onKeyDown={onKeyDown}
      className={cn(
        'flex',
        variant === 'underline'
          ? 'gap-1 border-b border-border'
          : // sit just above the card; the active tab + its fillets bridge the seam
            'relative z-10 -mb-px justify-center gap-1 px-3',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface TabProps extends Omit<HTMLAttributes<HTMLButtonElement>, 'value'> {
  value: string;
  disabled?: boolean;
  children: ReactNode;
}

export function Tab({ value, disabled, className, children, ...props }: TabProps) {
  const { value: active, setValue, baseId, variant } = useTabs('Tab');
  const selected = active === value;
  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${value}`}
      aria-selected={selected}
      aria-controls={`${baseId}-panel-${value}`}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      onClick={() => setValue(value)}
      className={cn(
        'text-sm font-medium whitespace-nowrap transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-45',
        variant === 'underline'
          ? cn(
              '-mb-px border-b-2 px-3.5 py-2',
              selected
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted hover:text-foreground',
            )
          : cn(
              'rounded-t-[16px] px-5 py-2.5',
              selected
                ? cn('relative bg-surface text-foreground', ATTACHED_FILLET)
                : 'text-muted hover:text-foreground',
            ),
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export interface TabPanelProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
}

export function TabPanel({ value, className, children, ...props }: TabPanelProps) {
  const { value: active, baseId, variant } = useTabs('TabPanel');
  // Inactive panels stay MOUNTED and are hidden with the `hidden` attribute (not unmounted):
  // panel content must be present in the server-rendered HTML — the detail page's About/FAQ
  // tabs are an SEO surface and crawlers don't click tabs. Also keeps every tab's
  // aria-controls target real.
  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      hidden={active !== value}
      tabIndex={0}
      className={cn(
        'focus-visible:outline-none',
        variant === 'underline' ? 'pt-4' : 'rounded-[var(--radius-panel)] bg-surface p-6',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
