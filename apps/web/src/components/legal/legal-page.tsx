import type { ComponentType, ReactNode } from 'react';
import Link from 'next/link';
import { Alert, Mail, cn } from '@beecompete/ui';
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_LAST_UPDATED,
  LEGAL_PAGES,
  LEGAL_REVIEW_PENDING,
  formatLegalDate,
} from '@/lib/legal';

// Shared chrome + prose primitives for the four legal pages (R1-12). One layout keeps the
// header, "under review" notice, typographic scale, table of contents, and cross-links identical
// across Privacy / Terms / Cookies / Affiliate Disclosure. The pages themselves only supply the
// copy. Prose styling is composed from the approved F7 tokens (font-display headings, muted body)
// — no new UI element type, so no fresh design reference is needed (same approach as How It Works).

type IconType = ComponentType<{
  className?: string;
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
  'aria-hidden'?: boolean | 'true' | 'false';
}>;

interface LegalPageProps {
  /** UNBRANDED page title (e.g. "Privacy Policy"). */
  title: string;
  icon: IconType;
  /** This page's own path, used to omit it from the "related policies" cross-links. */
  currentPath: string;
  /** One-line summary rendered under the title. */
  summary: string;
  /** {id,label} per top-level section → the "On this page" jump nav. Must match LegalSection ids. */
  sections: { id: string; label: string }[];
  children: ReactNode;
}

export function LegalPage({
  title,
  icon: Icon,
  currentPath,
  summary,
  sections,
  children,
}: LegalPageProps) {
  const related = LEGAL_PAGES.filter((p) => p.href !== currentPath);

  return (
    <article className="mx-auto grid max-w-3xl grid-cols-1 gap-8">
      <header className="grid gap-4">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">Legal</p>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-gold-soft">
            <Icon aria-hidden="true" weight="duotone" className="size-6 text-foreground" />
          </span>
          <div>
            <h1 className="font-display text-3xl text-foreground sm:text-4xl">{title}</h1>
            <p className="mt-1 text-sm text-muted">
              Last updated {formatLegalDate(LEGAL_LAST_UPDATED)}
            </p>
          </div>
        </div>
        <p className="text-lg leading-relaxed text-muted">{summary}</p>
      </header>

      {LEGAL_REVIEW_PENDING && (
        <Alert tone="warning" title="Draft — under review">
          BeeCompete is in beta and this policy is being finalized. We&apos;re reviewing it ahead of
          our public launch, and some details may change. Questions in the meantime? Email us at{' '}
          <LegalLink href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</LegalLink>.
        </Alert>
      )}

      {sections.length > 0 && (
        <nav
          aria-label="On this page"
          className="rounded-[var(--radius-panel)] border border-border p-5"
        >
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">On this page</h2>
          <ol className="mt-3 grid gap-2 sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-sm text-muted underline-offset-2 hover:text-foreground hover:underline"
                >
                  {i + 1}. {s.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="grid gap-10">{children}</div>

      <footer className="grid gap-4 border-t border-border pt-6">
        <div>
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
            Related policies
          </h2>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {related.map((p) => (
              <li key={p.href}>
                <Link
                  href={p.href}
                  className="text-muted underline-offset-2 hover:text-foreground hover:underline"
                >
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <Mail aria-hidden="true" className="size-4" />
          Questions about this policy? Email{' '}
          <LegalLink href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</LegalLink>.
        </p>
      </footer>
    </article>
  );
}

// ── Prose primitives ────────────────────────────────────────────────────────────────────────
// Small, consistent building blocks so each page reads as copy, not markup. Every section is a
// landmark with an id (anchor targets for the TOC + deep links).

export function LegalSection({
  id,
  heading,
  children,
}: {
  id: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="grid scroll-mt-24 gap-3">
      <h2 id={id} className="font-display text-xl text-foreground sm:text-2xl">
        {heading}
      </h2>
      {children}
    </section>
  );
}

export function LegalSubheading({ children }: { children: ReactNode }) {
  return <h3 className="mt-2 font-display text-lg text-foreground">{children}</h3>;
}

export function LegalP({ children }: { children: ReactNode }) {
  return <p className="leading-relaxed text-muted">{children}</p>;
}

export function LegalList({ children }: { children: ReactNode }) {
  return (
    <ul className="grid list-disc gap-2 pl-5 leading-relaxed text-muted marker:text-border">
      {children}
    </ul>
  );
}

export function LegalLI({ children }: { children: ReactNode }) {
  return <li className="pl-1">{children}</li>;
}

/** Inline link. Internal paths use next/link; mailto/external fall back to a plain anchor with
 *  the same styling. External http(s) links get safe rel + a new tab (matches the resources row). */
export function LegalLink({ href, children }: { href: string; children: ReactNode }) {
  const cls = 'font-medium text-foreground underline underline-offset-2 hover:text-brand-gold';
  const isInternal = href.startsWith('/');
  const isHttp = /^https?:\/\//.test(href);
  if (isInternal) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <a
      href={href}
      className={cn(cls)}
      {...(isHttp ? { target: '_blank', rel: 'nofollow noopener noreferrer' } : {})}
    >
      {children}
    </a>
  );
}
