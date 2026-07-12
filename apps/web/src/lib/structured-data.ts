import type { CompetitionDetail, EditionView, FaqView } from '@/lib/catalog-types';
import { currentEdition } from '@/lib/detail-display';
import { absoluteUrl } from '@/lib/site';

// schema.org JSON-LD for the detail page (page-blueprints Page 3 — the SEO landing surface).
// Emitted as <script type="application/ld+json">; indexing itself flips on site-wide at the
// R1 gate (R1-10/R1-17), so this markup ships ready and inert meanwhile. Best-effort: a block
// is only emitted when the underlying data exists, and only defined fields are included.

type JsonLd = Record<string, unknown>;

const ATTENDANCE_MODE: Record<string, string> = {
  virtual: 'https://schema.org/OnlineEventAttendanceMode',
  in_person: 'https://schema.org/OfflineEventAttendanceMode',
  hybrid: 'https://schema.org/MixedEventAttendanceMode',
};

function editionDateRange(edition: EditionView): { start?: string; end?: string } {
  const dates = [...edition.keyDates]
    .map((d) => d.startsAt)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  return { start: dates[0], end: dates[dates.length - 1] };
}

/** schema.org/Event for the current edition. Undefined when there's no dated edition to describe. */
export function eventJsonLd(competition: CompetitionDetail): JsonLd | undefined {
  const edition = currentEdition(competition.editions);
  if (!edition) return undefined;
  const { start, end } = editionDateRange(edition);
  if (!start) return undefined; // no dates → not a valid Event

  const online = competition.delivery === 'virtual';
  const location: JsonLd = online
    ? {
        '@type': 'VirtualLocation',
        url:
          edition.registrationUrl ??
          competition.officialUrl ??
          absoluteUrl(`/c/${competition.slug}`),
      }
    : {
        '@type': 'Place',
        name: edition.regions.map((r) => r.name).join(', ') || 'See organizer site',
      };

  const offers: JsonLd | undefined =
    competition.costType === 'free'
      ? {
          '@type': 'Offer',
          price: 0,
          priceCurrency: edition.currency ?? 'USD',
          url: edition.registrationUrl ?? competition.officialUrl ?? undefined,
          availability: 'https://schema.org/InStock',
        }
      : edition.entryFee != null
        ? {
            '@type': 'Offer',
            price: Number(edition.entryFee),
            priceCurrency: edition.currency ?? 'USD',
            url: edition.registrationUrl ?? competition.officialUrl ?? undefined,
          }
        : undefined;

  const event: JsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: competition.name,
    url: absoluteUrl(`/c/${competition.slug}`),
    startDate: start,
    eventAttendanceMode: ATTENDANCE_MODE[competition.delivery],
    eventStatus: 'https://schema.org/EventScheduled',
    location,
  };
  if (end && end !== start) event.endDate = end;
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

/** Serialize for a <script type="application/ld+json"> body, neutralizing "</script>" breakouts. */
export function jsonLdScript(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
