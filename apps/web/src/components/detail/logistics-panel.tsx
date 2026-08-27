import {
  Buildings,
  DollarSign,
  ExternalLink,
  Flag,
  Globe,
  MapPin,
  Restore,
  Ticket,
  Users,
} from '@beecompete/ui';
import {
  costLabel,
  currentEdition,
  deliveryLabel,
  displayUrl,
  entryFormatLabel,
  recurrenceLabel,
  scopeLabel,
} from '@/lib/detail-display';
import { DetailLedger, type LedgerItem } from '@/components/detail/detail-ledger';
import type { CompetitionDetail, EditionView } from '@/lib/catalog-types';

// The Logistics tab — "how this competition is run and how you sign up" (owner 2026-08-26, #108;
// redesigned #110, settled #111).
//
// ONE SHAPE FOR EVERY FIELD (owner 2026-08-27): an icon ledger. #110 opened the tab with a
// composed sentence over three rows; the sentence is gone and the facts it absorbed are now rows
// in the same register as Register / Official site / Locations. Nothing is prose here — a fact
// per row, aligned down a single label column, so the tab scans in one pass.
//
// This presents every field the admin form's `administration` step collects (#108's mirror),
// minus the contact pair, which moved to the FAQ tab (#110) — see contact-card.tsx.
//
// LINKS SHOW THEIR REAL ADDRESS (owner): "Official registration page" told a visitor nothing about
// where they were being sent. The visible text is the actual URL minus scheme/www, ellipsized by
// CSS when it outgrows the row — the href always carries the whole address, so what gets copied is
// never the shortened form. Both the registration link and the organizer's official site appear.
//
// ICONS are the curated Phosphor set via packages/ui — never emoji, never an inline SVG. Each row
// needs a DISTINCT glyph (two rows sharing one reads as a rendering bug), which is why a few
// depart from the At-a-glance strip's vocabulary: Ticket is the entry there but registration here,
// so cost takes DollarSign, and Globe stays with delivery while the organizer's own site takes
// Buildings. MapPin, Restore and Users match the strip exactly.
//
// ORDER (owner 2026-08-27, #113 · #114): the five SHORT fields lead — cost · delivery · scope ·
// runs · format, paired two-to-a-row — then locations, then the two links. The tab opens on the
// facts, says where it runs, and closes on the places you go next; the links sit last because
// they are the only rows that leave the site. This departs from the admin step's 2026-08-23
// field order; coverage is what mirrors that step, not row order.

/** http(s)-only gate — the same rule the rules link and resource cards apply to curated URLs. */
function safeUrl(url: string | null | undefined): string | null {
  return typeof url === 'string' && /^https?:\/\/\S+$/i.test(url.trim()) ? url.trim() : null;
}

function LinkValue({ url }: { url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer nofollow"
      className="inline-flex max-w-full items-baseline gap-1.5 underline underline-offset-2 hover:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <span className="min-w-0 truncate">{displayUrl(url)}</span>
      <ExternalLink aria-hidden="true" className="size-3.5 shrink-0 self-center" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

/** Every region of the current running, named — never "+2" (owner 2026-08-26). */
function regionNames(edition: EditionView | undefined): string[] {
  return (edition?.regions ?? []).map((r) => r.name);
}

export function LogisticsPanel({ competition }: { competition: CompetitionDetail }) {
  const edition = currentEdition(competition.editions);
  const registration = safeUrl(edition?.registrationUrl);
  const official = safeUrl(competition.officialUrl);
  const regions = regionNames(edition);

  // SHORT FIELDS FIRST (owner 2026-08-27, #113) — the five two-up facts open the tab, then the
  // full-width rows. The compact run is odd-length (five, or four without a curated scope) and is
  // now FOLLOWED by full-width rows, which would have left a hole beside its last item; the
  // ledger closes that itself by stretching the odd one across both columns.
  const items: LedgerItem[] = [
    {
      key: 'cost',
      icon: DollarSign,
      label: 'Cost',
      value: costLabel(competition, edition),
      compact: true,
    },
    {
      key: 'delivery',
      icon: Globe,
      label: 'Delivery',
      value: deliveryLabel(competition.delivery),
      compact: true,
    },
  ];
  if (edition?.scopeLevel) {
    items.push({
      key: 'scope',
      icon: Flag,
      label: 'Scope',
      value: scopeLabel(edition.scopeLevel),
      compact: true,
    });
  }
  items.push(
    {
      key: 'runs',
      icon: Restore,
      label: 'Runs',
      value: recurrenceLabel(competition.recurrence),
      compact: true,
    },
    // Participation + team size as ONE field: "1–3 members" alone says nothing without the mode,
    // and splitting them would need two near-identical people glyphs.
    {
      key: 'format',
      icon: Users,
      label: 'Format',
      value: entryFormatLabel(competition),
      compact: true,
    },
  );
  if (regions.length > 0) {
    items.push({
      key: 'locations',
      icon: MapPin,
      label: regions.length === 1 ? 'Location' : 'Locations',
      // Every region named, wrapping — "+2" belongs in the At-a-glance strip, where a one-line
      // cell has no choice; this row has the width not to.
      value: <span className="[overflow-wrap:anywhere]">{regions.join(' · ')}</span>,
    });
  }
  items.push({
    key: 'register',
    icon: Ticket,
    label: 'Register',
    value: registration ? (
      <LinkValue url={registration} />
    ) : (
      // Never fabricate a destination — the same wording the sidebar uses.
      <span className="font-normal text-muted">No registration link yet</span>
    ),
  });
  if (official) {
    items.push({
      key: 'official',
      icon: Buildings,
      label: 'Official site',
      value: <LinkValue url={official} />,
    });
  }

  return (
    <div className="grid gap-3">
      {/* The tab strip already names this panel, so the heading carries structure only. */}
      <h2 className="sr-only">Logistics</h2>
      <DetailLedger items={items} />
    </div>
  );
}
