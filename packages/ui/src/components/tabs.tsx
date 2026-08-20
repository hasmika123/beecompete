'use client';

import { createContext, useContext, useId, useRef, useState } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * Tabs — Details page At a glance/Details/About/FAQ (R1-7), admin. Roving-tabindex keyboard
 * model (←/→/Home/End), one panel visible at a time. Controlled via `value` or
 * self-managed with `defaultValue`.
 *
 * Two looks (`variant`):
 *  - `underline` (default): quiet tab strip with an active underline.
 *  - `pill` (owner reference image 2026-08-18, design-brief §1; recolored #101, detached
 *    #102): a free-standing `surface`-well pill bar with the content card right under it;
 *    the active tab is a GOLD pill with ink text (the brand-button pairing), inactive
 *    tabs are muted labels with a ghost-pill hover. Replaces the "folder tab" look (#92–#98).
 */

export type TabsVariant = 'underline' | 'pill';

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
          ? // Scrolls rather than clips (mobile pass). The detail page's four tabs measure 300px
            // of a 312px content column on a 320px phone, and the strip is a plain flex row, so
            // the last tab (FAQ) was simply cut off at the edge with no way to reach it. The pill
            // variant already had this recipe; the scrollbar stays hidden in both so the strip
            // reads as a tab bar rather than a scroller. Tabs themselves are `shrink-0` (below) —
            // without that the row would compress the labels instead of overflowing.
            'gap-1 overflow-x-auto border-b border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          : // The pill bar (owner reference; recolored #101, matched to the box #103): the
            // same `surface-raised` + hairline border as the content card under it, so the
            // pair reads as one material; the ghost-pill hovers and the gold pill supply
            // the contrast the well fill used to. This keeps the bar
            // sits IN the page palette and the gold pill is the only saturated thing.
            // Free-standing above the content card (owner #102 — bar OUTSIDE the box, box
            // right under it); p-1.5 nests the active pill. Long labels scroll
            // rather than wrap (ScrollRow's hidden-scrollbar recipe) — with justify-between
            // the spreading only kicks in once there is room anyway.
            'w-full items-center justify-between gap-1 overflow-x-auto rounded-full border border-border bg-surface-raised p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
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
        'shrink-0 text-sm font-medium whitespace-nowrap transition-colors duration-200',
        'disabled:opacity-45',
        variant === 'underline'
          ? cn(
              '-mb-px border-b-2 px-3.5 py-2',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
              selected
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted hover:text-foreground',
            )
          : cn(
              // Gold pill for the active tab — the brand-button pairing (gold fill + ink
              // text, design-brief §3), the one saturated accent on the light bar. Inactive
              // labels + their hover ghost use the secondary-button states (#101), so the
              // whole control is built from the page's existing material system. The light
              // bar also lets the standard ring token work again for focus.
              'rounded-full px-4 py-2 select-none sm:px-5',
              'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
              selected
                ? // Same hover/press feedback as the brand Button — the pill IS that pairing.
                  'bg-brand-gold font-semibold text-brand-ink hover:brightness-95 active:brightness-90'
                : // Ghost pill on hover, same fills as secondary Button hover/active.
                  'text-muted hover:bg-border/60 hover:text-foreground active:bg-border',
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
        variant === 'underline'
          ? 'pt-4'
          : // Its own card, tight under the free-standing bar (owner #102: "have the box
            // be right under the tabs" — mt-2, not the detached-feeling mt-4 of #99).
            'mt-2 rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
