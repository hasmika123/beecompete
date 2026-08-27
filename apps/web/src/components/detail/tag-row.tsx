import { Badge } from '@beecompete/ui';

// Curator keywords, rendered directly under the description in the page header (owner
// 2026-08-26). They lived on the More tab with a "Tags" heading until then — three clicks from
// the top of the page for the one piece of curated data that reads as part of the pitch.
//
// ⚠ NO VISIBLE HEADING, on purpose (owner): the chips are self-evident next to the description,
// and a bare "Tags" label above five words was more chrome than content. The accessible name
// moves to `aria-label` on the list instead — a screen reader still hears "Tags, list, 5 items",
// so dropping the <h2> costs sighted users nothing and non-sighted users nothing either. Do not
// "restore" the heading for a11y reasons; it is already handled.
//
// Not filterable at R1 — these are keywords, not the Category taxonomy, so they are deliberately
// NOT links. They become links if/when tag search ships.

// All tags share ONE soft brand-yellow tint (owner 2026-08-26 — "color the tags with a subtle
// color... the same color: maybe a light yellow from our branding palette"). That is exactly the
// Badge `gold` variant (bg-brand-gold-soft, #f9f0d2 light / #46401f dark, ink-dark text), so no
// local classes: the shared variant IS the recipe, and a multi-hue-per-tag palette was tried and
// rejected the same day in favour of the single brand tint.

export function TagRow({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <ul aria-label="Tags" className="mt-3 flex flex-wrap gap-2">
      {tags.map((tag) => (
        <li key={tag}>
          <Badge variant="gold">{tag}</Badge>
        </li>
      ))}
    </ul>
  );
}
