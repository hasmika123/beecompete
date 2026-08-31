'use client';

import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Chip, cn, Plus } from '@beecompete/ui';

/**
 * Tag entry as chips + an add button, replacing the raw comma-separated text box. Admin-only
 * (the competition create/import form), so it lives in the app rather than packages/ui — same
 * call as RegionPicker.
 *
 * The server contract is unchanged: a hidden input posts the tags comma-joined, which is exactly
 * what `list()` in lib/competition-payload splits back apart. That's why a tag may never itself
 * contain a comma — one typed mid-tag SPLITS it rather than being stored (same as pasting a
 * comma-separated list, which is the migration path from the old field).
 */

/** Matches the old free-text field's cap, which the serialized list still has to fit. */
const MAX_TOTAL_CHARS = 300;
const MAX_TAG_CHARS = 50;
/**
 * Five tags, max (owner 2026-08-30). The character cap alone allowed ~30 one-word tags, which is
 * not a tag list — it is a keyword dump, and it makes every listing's chip row look the same.
 * Five is enough to place a competition ("algebra", "proof-based", "team") and few enough that
 * each one has to earn its slot.
 */
const MAX_TAGS = 5;

export interface TagsInputProps {
  name: string;
  defaultValue?: string[];
  /** Supplied by FormField's cloning — forwarded to the real text input so the label points at it. */
  id?: string;
  'aria-describedby'?: string;
  'aria-required'?: boolean;
  'aria-invalid'?: boolean;
}

export function TagsInput({ name, defaultValue = [], ...aria }: TagsInputProps) {
  const [tags, setTags] = useState<string[]>(defaultValue);
  const [draft, setDraft] = useState('');

  const serialized = tags.join(', ');

  // Splits on comma so a pasted "algebra, geometry" lands as two chips, not one bad one.
  // Dedupes case-insensitively against what's already there — a duplicate tag is never useful.
  const commit = (raw: string) => {
    const candidates = raw
      .split(',')
      .map((t) => t.trim().slice(0, MAX_TAG_CHARS))
      .filter(Boolean);
    if (!candidates.length) return;
    setTags((current) => {
      const next = [...current];
      const seen = new Set(next.map((t) => t.toLowerCase()));
      for (const candidate of candidates) {
        if (seen.has(candidate.toLowerCase())) continue;
        // Stop at either cap rather than letting the server reject the whole submit.
        if (next.length >= MAX_TAGS) break;
        if ([...next, candidate].join(', ').length > MAX_TOTAL_CHARS) break;
        next.push(candidate);
        seen.add(candidate.toLowerCase());
      }
      return next;
    });
    setDraft('');
  };

  const remove = (tag: string) => setTags((current) => current.filter((t) => t !== tag));

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      // Enter inside a form SUBMITS it — this field would otherwise create the competition
      // every time someone finished typing a tag.
      event.preventDefault();
      commit(draft);
      return;
    }
    // Backspace on an empty box removes the last chip — the expected gesture in a token field.
    if (event.key === 'Backspace' && draft === '' && tags.length) {
      event.preventDefault();
      remove(tags[tags.length - 1]!);
    }
  };

  const atCapacity = tags.length >= MAX_TAGS || serialized.length >= MAX_TOTAL_CHARS;

  return (
    <div className="grid gap-2">
      {/* What actually posts. The visible controls never carry `name`, so a half-typed draft
          can't leak into the payload — only committed chips do. */}
      <input type="hidden" name={name} value={serialized} />

      {/* One field, not a field plus a button: the shell carries the input chrome (border, radius,
          focus ring via focus-within) and the + is a trailing affordance INSIDE it. The inner
          input is bare — its own border/ring would double up with the shell's. */}
      <div
        className={cn(
          'flex h-10 w-full items-center rounded-[var(--radius-field)] border bg-background pl-3.5 pr-1 transition-colors',
          'focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-ring',
          aria['aria-invalid'] ? 'border-danger' : 'border-border',
          atCapacity && 'opacity-60',
        )}
      >
        <input
          {...aria}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          // Committing on blur too, so a typed-but-unconfirmed tag isn't silently dropped when
          // the curator tabs onward and submits.
          onBlur={() => commit(draft)}
          maxLength={MAX_TAG_CHARS}
          placeholder={atCapacity ? `Limit reached (${MAX_TAGS} tags)` : 'Add a tag…'}
          disabled={atCapacity}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted focus:outline-none disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={() => commit(draft)}
          disabled={!draft.trim() || atCapacity}
          aria-label="Add tag"
          title="Add tag"
          className={cn(
            // size-8 inside the 40px field: comfortably clears the 24×24 minimum target without
            // crowding the field's inner edge.
            'grid size-8 shrink-0 place-items-center rounded-full transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
            // Filled once there's something to add, so the affordance reads as "this does
            // something now"; quiet and flat until then rather than a dead grey circle.
            'bg-primary text-primary-foreground hover:bg-primary/85',
            'disabled:bg-transparent disabled:text-muted disabled:hover:bg-transparent',
          )}
        >
          <Plus aria-hidden="true" weight="bold" className="size-4" />
        </button>
      </div>

      {/* Count, so the limit is visible BEFORE it is hit rather than only as a dead input. */}
      {tags.length > 0 && (
        <p className="text-xs text-muted">
          {tags.length} of {MAX_TAGS} tags
        </p>
      )}
      {tags.length > 0 && (
        // aria-live so removing/adding a chip is announced — the change happens away from focus
        // when the + button is what was clicked.
        <div className="flex flex-wrap gap-1.5" aria-live="polite">
          {tags.map((tag) => (
            <Chip key={tag} onRemove={() => remove(tag)} removeLabel={`Remove tag ${tag}`}>
              {tag}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}
