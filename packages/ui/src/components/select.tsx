'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { CaretDown, Check } from '@phosphor-icons/react/dist/ssr';
import { cn } from '../lib/cn';

/**
 * Select — accessible custom listbox (combobox pattern) so the expanded panel can be
 * styled: rounded 16px, hairline border, soft popover shadow (native <select> popups
 * can't be themed). Keyboard: ArrowUp/Down, Home/End, Enter/Space select, Escape/Tab
 * close. Uncontrolled (defaultValue) or controlled (value + onValueChange).
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
  id,
  className,
  ...aria
}: SelectProps) {
  const listboxId = useId();
  const optionId = (i: number) => `${listboxId}-opt-${i}`;

  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const value = controlledValue ?? uncontrolledValue;
  const selectedIndex = useMemo(
    () => options.findIndex((o) => o.value === value),
    [options, value],
  );
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const firstEnabled = useCallback(
    (from: number, dir: 1 | -1) => {
      for (let i = from; i >= 0 && i < options.length; i += dir) {
        if (!options[i]?.disabled) return i;
      }
      return -1;
    },
    [options],
  );

  const openList = useCallback(() => {
    if (disabled) return;
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : firstEnabled(0, 1));
    setOpen(true);
  }, [disabled, selectedIndex, firstEnabled]);

  const closeList = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  const commit = useCallback(
    (index: number) => {
      const opt = options[index];
      if (!opt || opt.disabled) return;
      if (controlledValue === undefined) setUncontrolledValue(opt.value);
      onValueChange?.(opt.value);
      closeList();
    },
    [options, controlledValue, onValueChange, closeList],
  );

  // Focus the list when opened; close on outside pointerdown.
  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) closeList(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, closeList]);

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

  const onListKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = firstEnabled(Math.min(activeIndex + 1, options.length - 1), 1);
        if (next >= 0 && activeIndex < options.length - 1) setActiveIndex(next);
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
        setActiveIndex(firstEnabled(options.length - 1, -1));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        commit(activeIndex);
        break;
      case 'Escape':
        e.preventDefault();
        closeList();
        break;
      case 'Tab':
        closeList(false);
        break;
    }
  };

  return (
    <div ref={rootRef} className={cn('relative', className)}>
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
          'flex h-10 w-full items-center justify-between gap-2 rounded-[var(--radius-field)] border border-border bg-background px-3.5 text-sm transition-colors',
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
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
          onKeyDown={onListKeyDown}
          className="absolute z-50 mt-2 max-h-64 w-full overflow-auto rounded-[var(--radius-panel)] border border-border bg-surface-raised p-1.5 shadow-[var(--shadow-popover)] focus-visible:outline-none"
        >
          {options.map((opt, i) => (
            <li
              key={opt.value}
              id={optionId(i)}
              role="option"
              aria-selected={i === selectedIndex}
              aria-disabled={opt.disabled || undefined}
              onPointerMove={() => !opt.disabled && setActiveIndex(i)}
              onClick={() => commit(i)}
              className={cn(
                'flex cursor-pointer items-center justify-between gap-2 rounded-[calc(var(--radius-panel)-6px)] px-3 py-2 text-sm text-foreground',
                i === activeIndex && 'bg-surface',
                opt.disabled && 'pointer-events-none opacity-45',
              )}
            >
              <span className="truncate">{opt.label}</span>
              {i === selectedIndex && <Check aria-hidden="true" className="size-4 shrink-0" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
