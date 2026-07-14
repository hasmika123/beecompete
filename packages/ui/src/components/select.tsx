'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { CaretDown, Check, MagnifyingGlass } from '@phosphor-icons/react/dist/ssr';
import { cn } from '../lib/cn';

/**
 * Select — accessible custom listbox (combobox pattern) so the expanded panel can be
 * styled: rounded 16px, hairline border, soft popover shadow (native <select> popups
 * can't be themed). Keyboard: ArrowUp/Down, Home/End, Enter/Space select, Escape/Tab
 * close. Uncontrolled (defaultValue) or controlled (value + onValueChange).
 *
 * Form participation: pass `name` and a visually-hidden native <select> mirrors the
 * value into FormData — drop it into uncontrolled server-action forms as-is. `required`
 * rides the same native select, so constraint validation blocks submit with the
 * browser bubble anchored over the trigger.
 *
 * Search: `searchable` (or automatically at ≥ 12 options) pins a filter input above
 * the option list. Typing filters (case-insensitive substring); ArrowDown/Up move the
 * active option while focus stays in the input; Enter commits; Escape clears the
 * query first, then closes.
 */

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Posts the selection into the enclosing form's FormData via a hidden native select. */
  name?: string;
  /** With `name`: native constraint validation blocks submit while nothing is selected. */
  required?: boolean;
  /** Pin a filter input above the options. Defaults to on at ≥ 12 options. */
  searchable?: boolean;
  /** Accessible name for the trigger — pair with a visible <label id> via aria-labelledby instead when possible. */
  'aria-label'?: string;
  'aria-labelledby'?: string;
  id?: string;
  className?: string;
}

export function Select({
  options,
  value: controlledValue,
  defaultValue,
  onValueChange,
  placeholder = 'Select…',
  disabled,
  name,
  required,
  searchable,
  id,
  className,
  ...aria
}: SelectProps) {
  const listboxId = useId();
  const optionId = (i: number) => `${listboxId}-opt-${i}`;
  const withSearch = searchable ?? options.length >= 12;

  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const value = controlledValue ?? uncontrolledValue;
  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // The option list the popover shows — filtered while a query is typed. activeIndex
  // indexes into THIS array, not `options`.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const firstEnabled = useCallback(
    (from: number, dir: 1 | -1) => {
      for (let i = from; i >= 0 && i < visible.length; i += dir) {
        if (!visible[i]?.disabled) return i;
      }
      return -1;
    },
    [visible],
  );

  const openList = useCallback(() => {
    if (disabled) return;
    setQuery('');
    const selectedIndex = options.findIndex((o) => o.value === value && !o.disabled);
    setActiveIndex(
      selectedIndex >= 0
        ? selectedIndex
        : (() => {
            for (let i = 0; i < options.length; i++) if (!options[i]?.disabled) return i;
            return -1;
          })(),
    );
    setOpen(true);
  }, [disabled, options, value]);

  const closeList = useCallback((refocus = true) => {
    setOpen(false);
    setQuery('');
    if (refocus) triggerRef.current?.focus();
  }, []);

  const commit = useCallback(
    (opt: SelectOption | undefined) => {
      if (!opt || opt.disabled) return;
      if (controlledValue === undefined) setUncontrolledValue(opt.value);
      onValueChange?.(opt.value);
      closeList();
    },
    [controlledValue, onValueChange, closeList],
  );

  // Focus the filter input (searchable) or the list when opened; close on outside pointerdown.
  useEffect(() => {
    if (!open) return;
    (withSearch ? searchRef.current : listRef.current)?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) closeList(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, withSearch, closeList]);

  // Keep the active option scrolled into view.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- optionId is stable per listboxId
  }, [open, activeIndex]);

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      openList();
    }
  };

  // Shared list navigation — fired from the list itself (plain) or the filter input (searchable).
  const onNavKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = firstEnabled(Math.min(activeIndex + 1, visible.length - 1), 1);
        if (next >= 0 && activeIndex < visible.length - 1) setActiveIndex(next);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = firstEnabled(Math.max(activeIndex - 1, 0), -1);
        if (prev >= 0 && activeIndex > 0) setActiveIndex(prev);
        break;
      }
      case 'Home':
        e.preventDefault();
        setActiveIndex(firstEnabled(0, 1));
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(firstEnabled(visible.length - 1, -1));
        break;
      case 'Enter':
        e.preventDefault();
        commit(visible[activeIndex]);
        break;
      case ' ':
        // Space selects in the plain list; in the filter input it types a space.
        if (!withSearch) {
          e.preventDefault();
          commit(visible[activeIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        if (withSearch && query) setQuery('');
        else closeList();
        break;
      case 'Tab':
        closeList(false);
        break;
    }
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {/* FormData + constraint-validation mirror. Not display:none — an invisible overlay,
          so a `required` failure can focus it and anchor the bubble on the trigger. */}
      {name && (
        <select
          name={name}
          required={required}
          value={value ?? ''}
          onChange={() => {}}
          aria-hidden="true"
          tabIndex={-1}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        >
          <option value="" disabled={required} hidden={required} />
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}

      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        disabled={disabled}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          'relative flex h-10 w-full items-center justify-between gap-2 rounded-[var(--radius-field)] border border-border bg-background px-3.5 text-sm transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
          'disabled:pointer-events-none disabled:opacity-45',
          selected ? 'text-foreground' : 'text-muted',
        )}
        {...aria}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <CaretDown
          aria-hidden="true"
          className={cn('size-4 shrink-0 text-muted transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface-raised shadow-[var(--shadow-popover)]">
          {withSearch && (
            <div className="flex items-center gap-2 border-b border-border px-3">
              <MagnifyingGlass aria-hidden="true" className="size-4 shrink-0 text-muted" />
              <input
                ref={searchRef}
                type="text"
                role="searchbox"
                aria-label="Filter options"
                aria-controls={listboxId}
                aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
                placeholder="Type to filter…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={onNavKeyDown}
                className="h-10 w-full bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none"
              />
            </div>
          )}
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            aria-activedescendant={
              !withSearch && activeIndex >= 0 ? optionId(activeIndex) : undefined
            }
            onKeyDown={withSearch ? undefined : onNavKeyDown}
            className="max-h-64 overflow-auto p-1.5 focus-visible:outline-none"
          >
            {visible.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted" aria-disabled="true">
                No matches.
              </li>
            )}
            {visible.map((opt, i) => (
              <li
                key={opt.value}
                id={optionId(i)}
                role="option"
                aria-selected={opt.value === value}
                aria-disabled={opt.disabled || undefined}
                onPointerMove={() => !opt.disabled && setActiveIndex(i)}
                onClick={() => commit(opt)}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-2 rounded-[calc(var(--radius-panel)-6px)] px-3 py-2 text-sm text-foreground',
                  i === activeIndex && 'bg-surface',
                  opt.disabled && 'pointer-events-none opacity-45',
                )}
              >
                <span className="truncate">{opt.label}</span>
                {opt.value === value && <Check aria-hidden="true" className="size-4 shrink-0" />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
