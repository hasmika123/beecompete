import { Star, Trophy } from '@beecompete/ui';
import { DetailLedger, type LedgerItem } from '@/components/detail/detail-ledger';
import { currentEdition, prizeLabel } from '@/lib/detail-display';
import type { CompetitionDetail } from '@/lib/catalog-types';

// "Awards" tab (blueprints #87) — what winning is worth. Renders the edition's TYPED prize
// fields (prize_value + prize_currency leading, prize_summary as the caption — same precedence
// as the At-a-glance strip's Prize line). Deliberately thin: the structured per-place breakdown
// is the reserved Award entity (H47), and this tab grows into it when that data exists — it does
// NOT model awards itself. Hidden entirely (hasAwardsData) when no prize is curated, because
// unlike the strip's "Bragging rights" fallback, an empty dedicated tab would be a shrug.

interface AwardEntry {
  title: string;
  type?: string;
  value?: number;
  currency?: string;
  detail?: string;
  /** Winner count when the award is given more than once ("best in each category"). ≥2 or absent. */
  count?: number;
}

/** Untrusted JSONB: keep only rows shaped like awards; anything else is "no rows". */
function awardRows(edition?: { attributes: Record<string, unknown> | null }): AwardEntry[] {
  const raw = edition?.attributes?.awards;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (a): a is AwardEntry =>
      a !== null && typeof a === 'object' && typeof (a as AwardEntry).title === 'string',
  );
}

function money(value: number, currency?: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency ?? 'USD',
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
  } catch {
    return `${value} ${currency ?? ''}`.trim();
  }
}

/** Whether a prize is actually CURATED — the "Bragging rights" fallback doesn't earn a tab. */
export function hasAwardsData(competition: CompetitionDetail): boolean {
  const edition = currentEdition(competition.editions);
  return (
    edition != null &&
    (awardRows(edition).length > 0 ||
      edition.prizeSummary != null ||
      (edition.prizeValue != null && Number(edition.prizeValue) > 0))
  );
}

export function AwardsPanel({ competition }: { competition: CompetitionDetail }) {
  const edition = currentEdition(competition.editions);
  const entries = awardRows(edition);

  // Row-per-award when the curated breakdown exists (owner 2026-08-23, stored in
  // attributes.awards until H47); the single derived prize line otherwise.
  //
  // ⚠ Icons REPEAT down this list on purpose, and that is not the duplicate-glyph bug the other
  // tabs guard against: those repeat a glyph across DIFFERENT fields, which reads as a rendering
  // error, whereas these are list items of the same KIND. Trophy = an award carrying money,
  // Star = an award that does not (a placement, a mentorship), so the two shapes stay tellable
  // apart at a glance — which is the whole reason the in-kind award needed distinguishing.
  const items: LedgerItem[] =
    entries.length > 0
      ? entries.map((a, i) => {
          // An award can carry BOTH an amount and a qualifier ("$2,500 · one per category"), so
          // the detail rides as a note beside the money rather than competing for the value slot
          // — it used to be either/or, which silently dropped the qualifier on every paid award.
          const hasMoney = a.value != null && a.value > 0;
          const detail = typeof a.detail === 'string' && a.detail.trim() !== '' ? a.detail : null;
          return {
            key: `award-${i}`,
            icon: hasMoney ? Trophy : Star,
            label: a.title,
            value: hasMoney ? money(a.value as number, a.currency) : (detail ?? '—'),
            // Only when money took the value slot; otherwise the note would repeat it verbatim.
            note: hasMoney && detail ? detail : undefined,
          };
        })
      : [{ key: 'prize', icon: Trophy, label: 'Prize', value: prizeLabel(edition) }];

  // NO "For the running" ROW (owner 2026-08-27, #115). The cycle label was the only non-award
  // row here and it answered a question nobody asked on this tab — which running the prizes
  // belong to is the whole page's context, not a property of the award list. Awards is now
  // strictly a list of what winning is worth.
  // ⚠ Side effect worth knowing: `edition.cycleLabel` is now rendered NOWHERE on the public
  // page. If a listing ever carries two live runnings, that becomes a real ambiguity — the fix
  // then is a heading on the tab, not a row back in the ledger.

  return (
    <div className="grid gap-3">
      <h2 className="sr-only">Awards</h2>
      {/* Wide label column (owner 2026-08-27, #113): here the label IS the content — an award's
          name — while the value is a short amount, the inverse of every other tab. */}
      <DetailLedger items={items} labelWidth="wide" />
    </div>
  );
}
