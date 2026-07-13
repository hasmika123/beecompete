import { ChevronDown } from '@beecompete/ui';
import type { FaqView } from '@/lib/catalog-types';

// FAQ tab (blueprints Page 3.3a, R1): 3–5 curated Q&As, the long-tail SEO block. Rendered as
// native <details> accordions (no JS needed); the matching FAQPage structured data is emitted
// separately in the page's JSON-LD. First item open by default.

export function FaqList({ faqs }: { faqs: FaqView[] }) {
  return (
    <div className="grid gap-2">
      {faqs.map((faq, i) => (
        <details
          key={`${i}-${faq.question}`}
          open={i === 0}
          className="group rounded-[var(--radius-field)] border border-border bg-surface-raised px-4 open:pb-4"
        >
          {/* list-none hides the marker in modern browsers; the arbitrary variant covers
              older WebKit's ::-webkit-details-marker (a bare `marker:hidden` is a no-op). */}
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden">
            {faq.question}
            <ChevronDown
              aria-hidden="true"
              className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180"
            />
          </summary>
          <p className="text-sm leading-relaxed whitespace-pre-line text-muted">{faq.answer}</p>
        </details>
      ))}
    </div>
  );
}
