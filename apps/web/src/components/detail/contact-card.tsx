import { Mail, Phone } from '@beecompete/ui';
import type { CompetitionDetail } from '@/lib/catalog-types';

// Organizer contact, on the FAQ tab (owner 2026-08-26, #110 — moved off Logistics).
//
// WHY HERE: "how do I reach a human" is a question, and this is the tab that answers questions.
// On Logistics it sat as two more rows in a facts table, which is where a contact address is
// least likely to be looked for. It renders AFTER the questions — a visitor reads the curated
// answers first and finds the escape hatch exactly when those run out.
//
// It also stands alone: a listing with contact details but no curated FAQs still shows this card
// (and the tab), so the fields never depend on unrelated data to be visible.
//
// ⚠ Untrusted JSONB, same gate as before the move: `contact_email`/`contact_phone` are curator
// free text, so each is validated before becoming a mailto:/tel:. An unparseable value renders as
// nothing rather than as a broken link.

/** One @, no spaces, a dotted domain. Gates what becomes a `mailto:` — not deliverability. */
function contactEmail(competition: CompetitionDetail): string | null {
  const value = competition.attributes?.contact_email;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

/** Digits plus the punctuation a dialable number may carry. */
function contactPhone(competition: CompetitionDetail): string | null {
  const value = competition.attributes?.contact_phone;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return /^[+()\-.\s\d]{7,}$/.test(trimmed) ? trimmed : null;
}

/** `tel:` wants the number stripped of the formatting a human reads (the label keeps it). */
function telHref(phone: string): string {
  return `tel:${phone.replace(/[^+\d]/g, '')}`;
}

export function hasContactData(competition: CompetitionDetail): boolean {
  return contactEmail(competition) != null || contactPhone(competition) != null;
}

export function ContactCard({ competition }: { competition: CompetitionDetail }) {
  const email = contactEmail(competition);
  const phone = contactPhone(competition);
  if (!email && !phone) return null;

  return (
    <section
      aria-labelledby="contact-heading"
      className="grid gap-3 rounded-[var(--radius-field)] bg-surface px-4 py-3.5"
    >
      <h3 id="contact-heading" className="text-sm font-medium text-foreground">
        Still have questions? Ask the organizer
      </h3>
      <ul className="flex flex-wrap gap-2">
        {email && (
          <li>
            <a
              href={`mailto:${email}`}
              rel="nofollow"
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-surface-raised px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Mail aria-hidden="true" weight="duotone" className="size-4 shrink-0 text-muted" />
              <span className="min-w-0 truncate">{email}</span>
            </a>
          </li>
        )}
        {phone && (
          <li>
            <a
              href={telHref(phone)}
              rel="nofollow"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-raised px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Phone aria-hidden="true" weight="duotone" className="size-4 shrink-0 text-muted" />
              <span className="tabular-nums">{phone}</span>
            </a>
          </li>
        )}
      </ul>
    </section>
  );
}
