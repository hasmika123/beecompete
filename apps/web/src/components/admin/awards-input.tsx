'use client';

import { useEffect, useState } from 'react';
import { FormField, GripHandle, Input, Plus, Select, Trash, Trophy, cn } from '@beecompete/ui';
import { EXAMPLE_AWARD_JSON, EXAMPLE_AWARD_ROW } from '@/lib/award-example';
import {
  asPrizeDisplayMode,
  derivedPrizeFields,
  type AwardJson,
  type PrizeDisplayMode,
} from '@/lib/competition-payload';

/**
 * Awards editor (owner 2026-08-23) — titled, ordered, typed prize rows. INTERIM storage: the rows
 * post as JSON and land in the edition's `attributes.awards` (no schema change); the H47 Award
 * entity lifts them into real rows at Phase 3. The payload builder DERIVES the card's typed
 * prize fields (prize_summary / prize_value / prize_currency) from these rows, so the listing
 * card and Awards tab stay populated without asking twice.
 *
 * ONE panel, not a stack of boxes (owner 2026-08-24 declutter): rows are hairline-divided lines
 * inside a single border, "Add award" is the panel's last row, and the card-line chooser is its
 * footer strip. Row controls (grip/arrows/trash) sit at half strength until the row is hovered
 * or focused — present for touch and keyboard, quiet the rest of the time.
 *
 * Reordering: drag by the grip (owner 2026-08-24 — the ↑↓ arrows were tried and REMOVED the
 * same day as clutter; the owner accepted drag-only, which leaves no keyboard reorder path).
 * The row is only made draggable while the pointer is on the grip, so selecting text in the
 * inputs never starts a drag.
 *
 * Value + currency render for the money-denominated types (monetary, scholarship — a "$10,000
 * scholarship" is an amount); trophies/medals and travel are described by their title alone.
 * Every row carries a ×N winner count (owner 2026-08-26) for awards given to several people —
 * best in each category, every finalist — one row, not N duplicates; amounts stay per winner.
 *
 * "Card preview" is its own titled section BELOW the rows panel (owner 2026-08-24 — tried in
 * the header row inline with the title and moved back the same day) — source dropdown left,
 * card-styled preview of the exact prize line right. The preview runs the SAME derivation the
 * submit path runs (`derivedPrizeFields`), so it cannot drift from what saves.
 */

export interface AwardRow {
  /** Stable list key only — never posted. */
  key: number;
  title: string;
  type: string;
  value: string;
  currency: string;
  /** Free-text for non-money types: "Gold medal + plaque", "8-week internship at the host org". */
  detail: string;
  /**
   * How many of this award are given (owner 2026-08-26) — "×6" for a prize awarded once per
   * category, or to every finalist. Blank = 1 and stores nothing; value/currency stay PER WINNER
   * (the total-mode sum multiplies). One row with a count, not six duplicate rows.
   */
  count: string;
}

export const AWARD_TYPES = [
  { value: 'monetary', label: 'Monetary' },
  { value: 'scholarship', label: 'Scholarship' },
  { value: 'trophy', label: 'Trophy / medal' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'internship', label: 'Internship / job' },
  { value: 'travel', label: 'Travel' },
  { value: 'other', label: 'Other' },
] as const;

/** Dollar-denominated types get value + currency; everything else gets a free-text detail. */
const MONEY_TYPES = new Set(['monetary', 'scholarship']);

/**
 * Currency is FIXED TO USD and no longer pickable (owner 2026-09-01). It was a USD/CAD/Other
 * dropdown; the catalog is US-facing, so the control asked a question with one answer on every row
 * and spent a curator's decision per award. It comes back when we support other countries — that
 * is a real feature, not a control to leave lying around until then.
 *
 * The row still CARRIES a currency, and an award that already stored something else keeps it: the
 * code is DISPLAYED rather than edited, so re-saving an old CAD award cannot silently
 * redenominate it. Only the ability to choose a new one is gone.
 */
const DEFAULT_CURRENCY = 'USD';

/** Pre-2026-08-23 rows used a catch-all token; read it as the nearest current type. */
const LEGACY_TYPE_MAP: Record<string, string> = { non_monetary: 'trophy' };

/**
 * 'titles' is deliberately NOT offered (owner 2026-08-24) — it survives in the derivation only
 * as the fallback when a mode has nothing to show (no money rows, blank custom text) and as the
 * reading of legacy editions saved before the chooser. The UI opens those as "Top award value".
 */
/** The house wording for "the placing IS the prize" — the same fallback the public card shows
 *  when an edition has no prize data at all, so the two can't disagree. */
const NO_AWARD_TEXT = 'Bragging rights';

const MODE_OPTIONS: { value: PrizeDisplayMode; label: string }[] = [
  { value: 'top', label: 'Top award value' },
  { value: 'total', label: 'Sum of monetary prizes' },
  { value: 'custom', label: 'Custom text' },
];

export function awardRowsFromSeed(
  seed: {
    title: string;
    type?: string;
    value?: number | string;
    currency?: string;
    detail?: string;
    count?: number;
  }[],
): AwardRow[] {
  return seed.map((a, i) => {
    const mapped = a.type ? (LEGACY_TYPE_MAP[a.type] ?? a.type) : undefined;
    return {
      key: i,
      title: a.title ?? '',
      type: mapped && AWARD_TYPES.some((t) => t.value === mapped) ? mapped : 'monetary',
      value: a.value != null ? String(a.value) : '',
      currency: a.currency ?? '',
      detail: a.detail ?? '',
      count: typeof a.count === 'number' && a.count >= 2 ? String(a.count) : '',
    };
  });
}

/** One blank row: the editor always shows at least one, because an award is expected, not optional. */
const emptyRow = (key: number): AwardRow => ({
  key,
  title: '',
  type: 'monetary',
  value: '',
  currency: '',
  detail: '',
  // Opens at 1 rather than blank (owner 2026-08-29). Blank already MEANT one — `toAwardJson`
  // stores a count only at 2+ — but a placeholder reads as unanswered on a step that now asks for
  // a complete row. Nothing about what gets saved changes.
  count: '1',
});

/** The rows exactly as the payload builder will read them — shared by post + preview. */
function toAwardJson(rows: AwardRow[]): AwardJson[] {
  return rows
    .filter((r) => r.title.trim() !== '')
    .map((r) => ({
      title: r.title.trim(),
      type: r.type,
      ...(MONEY_TYPES.has(r.type) && r.value !== ''
        ? { value: Number(r.value), currency: r.currency.trim().toUpperCase() || DEFAULT_CURRENCY }
        : {}),
      ...(!MONEY_TYPES.has(r.type) && r.detail.trim() !== '' ? { detail: r.detail.trim() } : {}),
      // Only a real multiple is stored — blank, "1", and junk all mean the default single award.
      ...(Math.floor(Number(r.count)) >= 2 ? { count: Math.floor(Number(r.count)) } : {}),
    }));
}

export function AwardsInput({
  name,
  initial,
  initialMode = 'total',
  initialCustom = '',
  onPrizeLineChange,
}: {
  name: string;
  initial: AwardRow[];
  /**
   * Stored card-line choice (edition attributes `prize_display_mode`). Defaults to `total`
   * (owner 2026-08-24) — a new listing's card should lead with the money on the table, and the
   * pre-filled example row makes that concrete from the first render. Only the CREATE form takes
   * this default; the edition editor passes the stored mode (falling back to the legacy `titles`,
   * which still opens as "Top award value").
   */
  initialMode?: string;
  /** The stored custom line (= the saved prize_summary when the mode was custom). */
  initialCustom?: string;
  /** Fires with whether the card will carry a prize line at all — feeds the completion ring. */
  onPrizeLineChange?: (hasLine: boolean) => void;
}) {
  const [rows, setRows] = useState<AwardRow[]>(initial.length > 0 ? initial : [emptyRow(0)]);
  const [nextKey, setNextKey] = useState(Math.max(initial.length, 1));
  const [mode, setMode] = useState<PrizeDisplayMode>(() => {
    const stored = asPrizeDisplayMode(initialMode);
    return stored === 'titles' ? 'top' : stored; // titles retired from the UI — see MODE_OPTIONS
  });
  const [customText, setCustomText] = useState(initialCustom);

  // --- drag reordering. dragKey = the row in hand; armed = grip held down (rows are only
  // draggable then, so text selection inside the inputs never starts a drag).
  const [dragKey, setDragKey] = useState<number | null>(null);
  const [armedKey, setArmedKey] = useState<number | null>(null);

  const patch = (key: number, delta: Partial<AwardRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...delta } : r)));
  /** Live reorder while dragging: the held row follows the row the pointer is over. */
  const dragOverRow = (overKey: number) => {
    if (dragKey === null || dragKey === overKey) return;
    setRows((rs) => {
      const from = rs.findIndex((r) => r.key === dragKey);
      const to = rs.findIndex((r) => r.key === overKey);
      if (from < 0 || to < 0) return rs;
      const next = [...rs];
      const [held] = next.splice(from, 1);
      next.splice(to, 0, held!);
      return next;
    });
  };

  /**
   * A row with every field its TYPE actually asks for: a money award needs a value, anything else
   * needs its detail line. A bare title is a started row, not a finished one (owner 2026-08-29).
   */
  const isComplete = (r: AwardRow) =>
    r.title.trim() !== '' &&
    (MONEY_TYPES.has(r.type) ? r.value.trim() !== '' : r.detail.trim() !== '');
  /**
   * What the ring needs is whether the awards question is ANSWERED — not whether rows exist.
   * Two answers count, and the second is why this cannot just count rows: "No award provided?"
   * deliberately clears them and writes a custom line, and plenty of real competitions award
   * nothing but the placing. Requiring a filled row there would make an honest answer unsubmittable.
   */
  const hasPrizeLine = rows.some(isComplete) || (mode === 'custom' && customText.trim() !== '');
  // (mode, not effectiveMode: `custom` is never auto-switched away from.)
  useEffect(() => {
    onPrizeLineChange?.(hasPrizeLine);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPrizeLine]);

  const awards = toAwardJson(rows);
  const serialized = JSON.stringify(awards);

  /**
   * `total` is the default, but it has nothing to sum once the rows turn out to be trophies and
   * certificates — it would quietly fall back to the joined titles, which is not what the
   * dropdown says it does. So it reads as `top` instead, which every award type can answer
   * (owner 2026-08-25). Only once rows EXIST: an empty editor is still demoing the monetary
   * example below.
   *
   * DERIVED, never synced into state (an effect calling setMode here is the cascading-render
   * pattern the react-hooks lint rejects, and rightly). Keeping the curator's own `total` choice
   * in state means the moment they add a money award it goes back to summing — a one-way state
   * flip would have silently thrown that choice away. This value is what the dropdown SHOWS, what
   * the preview derives from, and what posts, so the three cannot disagree.
   */
  const noMoneyEntered = awards.length > 0 && !awards.some((a) => typeof a.value === 'number');
  const effectiveMode: PrizeDisplayMode = mode === 'total' && noMoneyEntered ? 'top' : mode;

  /**
   * With nothing entered yet the preview renders the EXAMPLE the placeholders suggest, so the
   * "$10,000" here matches the grey "10000" in the field beside it and the box shows what the
   * control actually does. It is a demonstration, not a promise — hence `demoing`, which greys
   * the box the same way the placeholders are greyed. Custom mode is excluded: there the curator's
   * own text (or its absence) is the whole answer, and substituting an example would overwrite it.
   */
  const demoing = awards.length === 0 && effectiveMode !== 'custom';
  const preview = derivedPrizeFields(
    demoing ? [EXAMPLE_AWARD_JSON] : awards,
    effectiveMode,
    customText,
  ).prizeSummary;

  return (
    <div className="grid gap-3">
      <input type="hidden" name={name} value={serialized} />
      {/* No overflow-hidden: the type + card-line Selects open ABSOLUTE popovers inside this
          panel, and clipping them cut the list off. The footer rounds its own bottom corners. */}
      <div className="rounded-[var(--radius-field)] border border-border">
        <div className="divide-y divide-border">
          {rows.map((row, i) => (
            <div
              key={row.key}
              draggable={armedKey === row.key}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                setDragKey(row.key);
              }}
              onDragEnd={() => {
                setDragKey(null);
                setArmedKey(null);
              }}
              onDragOver={(e) => {
                e.preventDefault(); // required for the drop cursor; reorder happens on enter
              }}
              onDragEnter={() => dragOverRow(row.key)}
              className={cn(
                // WIDTHS ARE LOAD-BEARING (#118). A flex line breaks on the sum of its children's
                // flex BASE sizes, and the admin form's column is ~623px wide on a 1000px screen —
                // 16px too narrow, which left the ×N group and the delete button stranded alone on
                // a second line while everything else fitted. The row now clears that width.
                //
                // The space originally came from the TITLE's basis (10rem → 5rem), not from the
                // fixed controls: trimming the selects made their labels truncate ("USD · $" →
                // "USD ·…", "Monetary" → "Monetar…"), which is a worse defect than a narrow text
                // input — the input scrolls, a clipped label just lies.
                // ↻ PARTLY REVERSED 2026-08-28 (owner): the currency label lost its symbol, so that
                // select fits 5.25rem instead of w-28 WITHOUT truncating, and the freed 28px goes
                // to the Title. Measured, not guessed: the widest label ("Other") is 37px, and the
                // trigger spends 52px on chrome at the default padding — so 96px really was the
                // floor until `dense` cut that to 44px. ⚠ A className on Select styles its ROOT,
                // not its trigger; padding passed there just shrinks the trigger inside it.
                // ⚠ The title's BASIS stays 5rem. It does not need raising — Title is `flex-1`, so
                // it already absorbs every pixel the fixed controls give up. Raising the basis only
                // moves the WRAP POINT, because a flex line breaks on the sum of its children's
                // BASE sizes: basis-32 was tried and put the row back onto two lines at a 609px
                // panel, which is the exact defect this note exists to prevent.
                // ⚠ The type select still truncates its LONGEST options ("Internship / job") at
                // any width — that predates this and is what its `truncate` is for.
                // If you add a control here, re-measure at a ~620px panel before assuming it fits.
                'group flex flex-wrap items-center gap-2 px-2.5 py-2',
                // Soft gold wash, not a ring: the panel clips overflow, and a ring would too.
                dragKey === row.key && 'bg-brand-gold-soft/50 opacity-80',
              )}
            >
              {/* Grip + rank read as ONE quiet ordinal block; controls wake on hover/focus. */}
              <button
                type="button"
                aria-hidden="true"
                tabIndex={-1}
                onMouseDown={() => setArmedKey(row.key)}
                onMouseUp={() => setArmedKey(null)}
                className="hidden cursor-grab touch-none text-muted/50 group-focus-within:text-muted group-hover:text-muted active:cursor-grabbing sm:block"
              >
                <GripHandle className="size-4" />
              </button>
              <span aria-hidden="true" className="w-4 text-center text-xs text-muted tabular-nums">
                {i + 1}
              </span>
              <Input
                aria-label={`Award ${i + 1} title`}
                placeholder={EXAMPLE_AWARD_ROW.title}
                value={row.title}
                maxLength={200}
                onChange={(e) => patch(row.key, { title: e.target.value })}
                className="min-w-0 flex-1 basis-20"
              />
              <Select
                aria-label={`Award ${i + 1} type`}
                options={AWARD_TYPES.map((t) => ({ value: t.value, label: t.label }))}
                value={row.type}
                onValueChange={(v) => patch(row.key, { type: v })}
                className="w-32 shrink-0"
              />
              {MONEY_TYPES.has(row.type) ? (
                <div className="flex shrink-0 items-center gap-2">
                  <Input
                    aria-label={`Award ${i + 1} value`}
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder={EXAMPLE_AWARD_ROW.value}
                    value={row.value}
                    onChange={(e) => patch(row.key, { value: e.target.value })}
                    className="w-24"
                  />
                  {/* Static code, not a control: it is the UNIT on the amount beside it, the way
                    "kg" sits after a weight. Read-only text rather than a disabled Select because a
                    disabled control still reads as "something you could change" and still costs a
                    glance. It keeps the select's old 5.25rem so the row's measured wrap point (see
                    the widths note above) is unchanged. */}
                  <span className="w-[5.25rem] shrink-0 text-sm text-muted tabular-nums">
                    {row.currency.toUpperCase() || DEFAULT_CURRENCY}
                  </span>
                </div>
              ) : (
                <Input
                  aria-label={`Award ${i + 1} details`}
                  placeholder={
                    row.type === 'internship'
                      ? 'e.g. 8-week internship'
                      : row.type === 'travel'
                        ? 'e.g. trip to the final'
                        : 'e.g. medal + plaque'
                  }
                  value={row.detail}
                  onChange={(e) => patch(row.key, { detail: e.target.value })}
                  maxLength={300}
                  className="min-w-0 flex-1 basis-20"
                />
              )}
              {/* ×N = how many of THIS award are given (owner 2026-08-26) — "$2,500 ×6" for one
                  per category, medals ×3 for every podium place. Blank means one; the amount
                  beside it stays per winner. The glyph does the labeling — a word would crowd
                  the row, and the tooltip carries the sentence for anyone who hovers. */}
              <div
                className="flex shrink-0 items-center gap-1"
                title="Number of winners receiving this award — e.g. 6 when it goes to the best in each of 6 categories. Leave blank for a single winner; the value stays per winner."
              >
                <span aria-hidden="true" className="text-sm text-muted">
                  ×
                </span>
                <Input
                  aria-label={`Award ${i + 1} number of winners`}
                  type="number"
                  min={1}
                  step={1}
                  placeholder="1"
                  value={row.count}
                  onChange={(e) => patch(row.key, { count: e.target.value })}
                  className="w-12"
                />
              </div>
              {/* Dimmed, never hidden: touch has no hover, keyboard users tab straight in. */}
              <button
                type="button"
                aria-label={`Remove award ${i + 1}`}
                // The last row clears instead of disappearing: an award is expected, not optional.
                onClick={() =>
                  setRows((rs) =>
                    rs.length === 1 ? [emptyRow(rs[0]!.key)] : rs.filter((r) => r.key !== row.key),
                  )
                }
                className="ml-auto grid size-7 shrink-0 place-items-center rounded text-muted opacity-50 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-background hover:text-danger"
              >
                <Trash aria-hidden="true" className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
        {/* The panel's own last row, not a floating button — one shape holds the whole editor.
            "No award provided?" shares it: the two are the only ways this panel ends, and the
            escape hatch has to be as findable as the add. */}
        <div className="flex items-center justify-between gap-2 rounded-b-[calc(var(--radius-field)-1px)] border-t border-border">
          <button
            type="button"
            onClick={() => {
              setRows((rs) => [...rs, emptyRow(nextKey)]);
              setNextKey((k) => k + 1);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            <Plus aria-hidden="true" className="size-4" /> Add award
          </button>
          {/* Plenty of real competitions award nothing but the placing itself. Before this, saying
              so meant knowing to clear the rows AND to switch the card line to custom AND to guess
              the house wording — three steps to record an absence. One click now does all three
              (owner 2026-08-24). It CLEARS the rows on purpose: leaving the example behind would
              save a $10,000 award under a card line that reads "Bragging rights". */}
          <button
            type="button"
            onClick={() => {
              setRows([emptyRow(nextKey)]);
              setNextKey((k) => k + 1);
              setMode('custom');
              setCustomText(NO_AWARD_TEXT);
            }}
            // Underlined at REST, not only on hover (owner 2026-08-29): it sat as plain grey text
            // next to "Add award", so nothing said it was clickable until a pointer found it —
            // and a touch user never gets that hint at all. `decoration-muted/50` keeps it quiet
            // enough not to compete with the add button beside it.
            className="px-3.5 py-2.5 text-sm font-medium text-muted underline decoration-muted/50 underline-offset-2 transition-colors hover:text-foreground hover:decoration-current"
          >
            No award provided?
          </button>
        </div>
      </div>
      {/* Its own titled section, deliberately OUTSIDE the rows panel (owner 2026-08-24): the
          panel is "what the awards are", this is "what the card will say". The ⓘ carries the
          explanation so nothing is labeled twice; the dropdown picks the source, the box beside
          it IS the line the card will show. */}
      <FormField
        label="Card preview"
        labelAsText
        hintAs="icon"
        hint="how the awards above become the single prize line on the listing card — pick a source on the left; the box on the right shows the exact line."
      >
        {/* Three tracks when the custom box is open, two otherwise (owner 2026-08-24): the text
            box sits BETWEEN the source dropdown and the preview, so the row reads left-to-right
            as cause → input → effect. It used to stack under the dropdown, which put the thing
            being typed furthest from the box showing its result. */}
        <div
          className={cn(
            'grid items-start gap-3',
            effectiveMode === 'custom'
              ? 'sm:grid-cols-[14rem_1fr_auto]'
              : 'sm:grid-cols-[14rem_auto]',
          )}
        >
          <Select
            aria-label="Card prize line source"
            name={`${name}Mode`}
            options={MODE_OPTIONS}
            value={effectiveMode}
            onValueChange={(v) => setMode(asPrizeDisplayMode(v))}
          />
          {effectiveMode === 'custom' && (
            <Input
              aria-label="Custom card prize line"
              name={`${name}Custom`}
              placeholder="e.g. Up to $15,000 in prizes"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              maxLength={200}
              className="min-w-0"
            />
          )}
          {/* Dashed = "rendering of something else" (the empty-upload grammar). Inside: the
              CompetitionCard's own prize markup (gold Trophy fill + semibold). w-44 ≈ the card's
              real prize track (~110–150px of text), so a line that will truncate on the card
              truncates HERE, in front of the curator, not in production. */}
          <div
            aria-label="Card prize line preview"
            className="flex min-h-10 w-44 items-center gap-1.5 rounded-[var(--radius-field)] border border-dashed border-border bg-surface px-3"
          >
            <Trophy aria-hidden="true" weight="fill" className="size-4 shrink-0 text-brand-gold" />
            <strong
              className={cn(
                'truncate text-sm font-semibold',
                demoing ? 'text-muted' : 'text-foreground',
              )}
            >
              {preview ?? 'Bragging rights'}
            </strong>
          </div>
        </div>
      </FormField>
    </div>
  );
}
