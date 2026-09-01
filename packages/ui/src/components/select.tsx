'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { CaretDown, Check, MagnifyingGlass } from '@phosphor-icons/react/dist/ssr';
import { cn } from '../lib/cn';
import { Badge } from './badge';

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
 *
 * Multi-select: `multiple` + `values` + `onValuesChange`. Options TOGGLE and the popover stays
 * open (closing after each pick would make choosing three options three trips), the trigger reads
 * the chosen labels joined, and the hidden mirror becomes a native `<select multiple>` — so the
 * form posts one entry per value under the same `name`, which is what `multi()` reads on the
 * server. `required` still rides that mirror: nothing selected blocks submit.
 */

export interface SelectOption {
  value: string;
  label: string;
  /**
   * Compact form for the TRIGGER, when the full `label` is written to explain the option inside
   * the list ("Individual — signs up on their own" → "Individual"). Multi-select only, where the
   * trigger has to hold several at once. Falls back to `label`.
   */
  shortLabel?: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Turns the listbox into a multi-select; pair with `values` + `onValuesChange`. */
  multiple?: boolean;
  /** Selected values in `multiple` mode. Controlled only — there is no uncontrolled variant. */
  values?: string[];
  onValuesChange?: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Posts the selection into the enclosing form's FormData via a hidden native select. */
  name?: string;
  /** With `name`: native constraint validation blocks submit while nothing is selected. */
  required?: boolean;
  /** Pin a filter input above the options. Defaults to on at ≥ 12 options. */
  searchable?: boolean;
  /**
   * Tightens the TRIGGER's horizontal padding (3.5 → 2.5). For a select whose values are a few
   * characters wide — a currency code — where the default padding, not the text, is what sets the
   * control's minimum width. Nothing else changes: same height, same popover, same type scale.
   */
  dense?: boolean;
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
  multiple = false,
  values,
  onValuesChange,
  placeholder = 'Select…',
  disabled,
  name,
  required,
  searchable,
  dense = false,
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
  const picked = useMemo(() => values ?? [], [values]);
  const isPicked = useCallback((v: string) => picked.includes(v), [picked]);
  /** Chosen options in OPTION order, so the same selection always reads the same. */
  const pickedOptions = useMemo(
    () => options.filter((o) => picked.includes(o.value)),
    [options, picked],
  );
  const hasSelection = multiple ? picked.length > 0 : selected != null;

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
    const selectedIndex = options.findIndex((o) =>
      multiple ? picked.includes(o.value) && !o.disabled : o.value === value && !o.disabled,
    );
    setActiveIndex(
      selectedIndex >= 0
        ? selectedIndex
        : (() => {
            for (let i = 0; i < options.length; i++) if (!options[i]?.disabled) return i;
            return -1;
          })(),
    );
    setOpen(true);
  }, [disabled, options, value, multiple, picked]);

  const closeList = useCallback((refocus = true) => {
    setOpen(false);
    setQuery('');
    if (refocus) triggerRef.current?.focus();
  }, []);

  const commit = useCallback(
    (opt: SelectOption | undefined) => {
      if (!opt || opt.disabled) return;
      if (multiple) {
        // Toggle and STAY OPEN — picking three options should be one trip, not three.
        onValuesChange?.(
          picked.includes(opt.value)
            ? picked.filter((v) => v !== opt.value)
            : [...picked, opt.value],
        );
        return;
      }
      if (controlledValue === undefined) setUncontrolledValue(opt.value);
      onValueChange?.(opt.value);
      closeList();
    },
    [multiple, picked, onValuesChange, controlledValue, onValueChange, closeList],
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
          multiple={multiple}
          value={multiple ? picked : (value ?? '')}
          onChange={() => {}}
          aria-hidden="true"
          tabIndex={-1}
          className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        >
          {/* The empty option exists so a single select can hold "nothing chosen". A `multiple`
              select expresses that as an empty selection, and an empty <option> inside one would
              post a stray "" alongside the real values. */}
          {!multiple && <option value="" disabled={required} hidden={required} />}
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
          'relative flex h-10 w-full items-center justify-between gap-2 rounded-[var(--radius-field)] border border-border bg-background text-sm transition-colors',
          dense ? 'px-2.5' : 'px-3.5',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
          'disabled:pointer-events-none disabled:opacity-45',
          hasSelection ? 'text-foreground' : 'text-muted',
        )}
        {...aria}
      >
        {/* Multi-select shows its picks as TAGS rather than a joined sentence: with several chosen,
            run-on text is unreadable at a glance and truncating it hides which ones. Badge (a
            <span>) not Chip (a <button>) — a button inside this button is invalid HTML and breaks
            the trigger for assistive tech. Tags never wrap (the trigger is one field-height row),
            so an overlong set clips at the caret; `shortLabel` is how a caller avoids that.

            min-w-0 lets the single-select label truncate INSIDE the fixed-width trigger — without
            it a long selection (e.g. "Grade Pre-K (5)") overflows into the neighbouring field. */}
        {multiple && pickedOptions.length > 0 ? (
          <span className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
            {pickedOptions.map((o) => (
              <Badge key={o.value} variant="neutral" className="shrink-0">
                {o.shortLabel ?? o.label}
              </Badge>
            ))}
          </span>
        ) : (
          <span className="min-w-0 flex-1 truncate text-left">
            {multiple ? placeholder : (selected?.label ?? placeholder)}
          </span>
        )}
        <CaretDown
          aria-hidden="true"
          className={cn('size-4 shrink-0 text-muted transition-transform', open && 'rotate-180')}
        />
      </button>

      {/* Popover: at least the trigger width, but grows to fit the longest option so values
          aren't clipped (capped so it never runs off-screen). */}
      {open && (
        <div className="absolute z-50 mt-2 w-max min-w-full max-w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface-raised shadow-[var(--shadow-popover)]">
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
            aria-multiselectable={multiple || undefined}
            tabIndex={-1}
            aria-activedescendant={
              !withSearch && activeIndex >= 0 ? optionId(activeIndex) : undefined
            }
            onKeyDown={withSearch ? undefined : onNavKeyDown}
            className="scrollbar-sleek max-h-64 overflow-auto p-1.5 focus-visible:outline-none"
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
                aria-selected={multiple ? isPicked(opt.value) : opt.value === value}
                aria-disabled={opt.disabled || undefined}
                onPointerMove={() => !opt.disabled && setActiveIndex(i)}
                onClick={() => commit(opt)}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-2 rounded-[calc(var(--radius-panel)-6px)] px-3 py-2 text-sm text-foreground',
                  i === activeIndex && 'bg-surface',
                  opt.disabled && 'pointer-events-none opacity-45',
                )}
              >
                <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                {(multiple ? isPicked(opt.value) : opt.value === value) && (
                  <Check aria-hidden="true" className="size-4 shrink-0" />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
