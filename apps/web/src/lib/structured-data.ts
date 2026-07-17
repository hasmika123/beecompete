import type {
  CompetitionDetail,
  CompetitionSummary,
  EditionView,
  FaqView,
  KeyDateView,
} from '@/lib/catalog-types';
import { currentEdition } from '@/lib/detail-display';
import { isoDateInZone } from '@/lib/dates';
import { SITE_NAME, SITE_URL, absoluteUrl } from '@/lib/site';

// schema.org JSON-LD for the detail page (page-blueprints Page 3 — the SEO landing surface).
// Emitted as <script type="application/ld+json">; indexing itself flips on site-wide at the
// R1 gate (R1-10/R1-17), so this markup ships ready and inert meanwhile. Best-effort: a block
// is only emitted when the underlying data exists, and only defined fields are included.

type JsonLd = Record<string, unknown>;

// The dates that describe the EVENT itself — registration windows are excluded on purpose:
// Google renders startDate as "Event starts …", and "registration opens" is not when the
// event starts (review fix M3).
const EVENT_DATE_TYPES = new Set(['round_start', 'submission_due', 'results', 'custom']);

function eventDates(edition: EditionView): KeyDateView[] {
  // TBD dates (null startsAt, R1-18) can't anchor an Event's startDate — excluded.
  return edition.keyDates
    .filter((d) => EVENT_DATE_TYPES.has(d.type) && d.startsAt != null)
    .sort((a, b) => new Date(a.startsAt!).getTime() - new Date(b.startsAt!).getTime());
}

/**
 * schema.org/Event for the current edition — VIRTUAL competitions only (review fix M3):
 * Google requires location.address for offline events and the catalog stores regions, not
 * street addresses, so an in-person/hybrid Event block would fail rich-result validation.
 * Revisit if venue addresses ever land in the schema. Dates are date-only strings in the key
 * date's own zone (H1); undefined when there's no dated virtual edition to describe.
 */
export function eventJsonLd(competition: CompetitionDetail): JsonLd | undefined {
  if (competition.delivery !== 'virtual') return undefined;
  const edition = currentEdition(competition.editions);
  if (!edition) return undefined;
  const dates = eventDates(edition);
  const first = dates[0];
  if (!first) return undefined; // no event-phase dates → not a valid Event
  const last = dates[dates.length - 1] ?? first;
  // Non-null asserted: eventDates() filtered out null startsAt above.
  const start = isoDateInZone(first.startsAt!, first.timezone);
  const end = isoDateInZone(last.endsAt ?? last.startsAt!, last.timezone);

  // Paid Offer only with a real fee — price 0 on a paid competition reads as "free" (L1).
  const fee = edition.entryFee != null ? Number(edition.entryFee) : null;
  const offerUrl = edition.registrationUrl ?? competition.officialUrl ?? undefined;
  const offers: JsonLd | undefined =
    competition.costType === 'free'
      ? {
          '@type': 'Offer',
          price: 0,
          priceCurrency: edition.currency ?? 'USD',
          url: offerUrl,
          availability: 'https://schema.org/InStock',
        }
      : fee != null && fee > 0
        ? {
            '@type': 'Offer',
            price: fee,
            priceCurrency: edition.currency ?? 'USD',
            url: offerUrl,
          }
        : undefined;

  const event: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: competition.name,
    url: absoluteUrl(`/c/${competition.slug}`),
    startDate: start,
    eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: {
      '@type': 'VirtualLocation',
      url:
        edition.registrationUrl ?? competition.officialUrl ?? absoluteUrl(`/c/${competition.slug}`),
    },
  };
  if (end !== start) event.endDate = end;
  if (competition.summary || competition.description)
    event.description = competition.summary ?? competition.description ?? undefined;
  if (competition.organizer)
    event.organizer = { '@type': 'Organization', name: competition.organizer.name };
  if (offers) event.offers = offers;
  return event;
}

/** BreadcrumbList matching the visible breadcrumb (Competitions › Category › Competition). */
export function breadcrumbJsonLd(competition: CompetitionDetail): JsonLd {
  const trail = [
    { name: 'Competitions', path: '/competitions' },
    { name: `${competition.category.name}`, path: `/competitions/${competition.category.slug}` },
    { name: competition.name, path: `/c/${competition.slug}` },
  ];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: absoluteUrl(t.path),
    })),
  };
}

/** FAQPage from curated Q&As (blueprints Page 3a — the long-tail SEO block). Undefined when none. */
export function faqJsonLd(faqs: FaqView[]): JsonLd | undefined {
  if (faqs.length === 0) return undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

/** WebSite + Organization for the landing page (R1-10) — brand entity + name in search. */
export function siteJsonLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_URL,
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
    ],
  };
}

/**
 * ItemList of the competitions shown on a listing page (R1-10) — gives crawlers the ordered
 * set of detail-page URLs (the "Event markup on listings" the plan calls for; each item's own
 * Event data lives on its detail page). Undefined when the list is empty.
 */
export function itemListJsonLd(items: CompetitionSummary[]): JsonLd | undefined {
  if (items.length === 0) return undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: absoluteUrl(`/c/${item.slug}`),
      name: item.name,
    })),
  };
}

/** Serialize for a <script type="application/ld+json"> body, neutralizing "</script>" breakouts. */
export function jsonLdScript(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
