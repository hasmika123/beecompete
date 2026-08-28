import Link from 'next/link';
import { Badge, Info, cn } from '@beecompete/ui';
import { ScrollRow } from '@/components/scroll-row';
import { ResourceArt } from '@/components/detail/resource-art';
import { resourceTypeLabel, youtubeThumbnail } from '@/lib/detail-display';
import type { ResourceView } from '@/lib/catalog-types';

// Resources section (blueprints Page 3.3b, → M11) + affiliate disclosure (🔒 DQ10, R1-8). A
// horizontally scrollable row of resource cards; affiliate links carry rel="sponsored nofollow"
// and are marked individually with an "Affiliate" chip, and a clear, conspicuous disclosure
// renders WITH the row whenever any affiliate link is present (FTC endorsement rule), linking to
// the dedicated /affiliate-disclosure page (R1-12). Non-affiliate outbound links stay nofollow too;
// we link to third parties factually and vouch for none (nominative use, compliance §8).
//
// 🔒 The note below — not the /affiliate-disclosure page — is what satisfies the FTC:
// the Endorsement Guides turn on proximity, and a disclosure behind a hyperlink doesn't count,
// so it must stay next to the links, ABOVE the row, in plain words. The "As an Amazon
// Associate..." sentence is separately required VERBATIM by the Amazon Associates Operating
// Agreement (enrolled 2026-08-25, tag `beecompete-20`) on any page carrying its links — a
// contract term, breach of which costs the account. Reword neither. Amazon is the only network
// today; adding a second one makes that sentence conditional, never deleted.
//
// ⚠ Above the row is deliberate and was re-confirmed on 2026-08-26, after a same-day experiment
// moved it BELOW the cards and put it back. A visitor must be able to read it before clicking an
// affiliate card, not after — "clear and conspicuous" is about what the reader sees FIRST. The
// per-card "Affiliate" tag is a second, independent marking at each link; it complements this
// paragraph and never substitutes for it. Do not move this note below the cards again.

// Generic per-type cover art (owner 2026-08-26), served from /public. This replaced the older
// tint-panel + duotone-icon fallback: every card now shows an IMAGE — real art when the curator
// set one, this generic art otherwise (and, via ResourceArt's onError, when the real art is a
// dead link). Each file is drawn in the shape of the thing it stands for — 2:3 book jacket,
// letter page with a folded corner, 16:9 player frame — because on a grey mat the silhouette is
// what tells you what kind of resource you're looking at before you read the tag. Hues inside
// the SVGs follow the same per-type convention as TYPE_TAG below (indigo/rose/emerald/amber,
// neutral for "other"); they're baked into the files, so retuning the tag hues means redrawing
// these too. The SVGs are deliberately abstract — bars, not words — so they never read as a
// specific real title.
const TYPE_FALLBACK_ART: Record<string, string> = {
  book: '/resource-art/book.svg',
  past_paper: '/resource-art/past-paper.svg',
  guide: '/resource-art/guide.svg',
  video: '/resource-art/video.svg',
  other: '/resource-art/other.svg',
};

// Per-type hues for the type TAG (owner 2026-08-26 — "colour the type tags to their
// corresponding colours"), matching the hues baked into TYPE_FALLBACK_ART so a card's chip and
// its art read as one object. 12px text on these tints has to clear WCAG AA 4.5:1.
//
// Desaturated later the same day (owner: the first pass "read a bit too neon"). The fix is
// chroma, not hue — the hues still have to match the art box, so instead of the solid -100/-950
// steps these mix the hue INTO the card ground at low alpha (`-500/10`, `-400/15`) and carry the
// text at the far ends of the ramp (-900 light, -100 dark). Deep navy/maroon/forest/umber and
// near-white read as muted at 12px where -700-on--100 read as a highlighter, and the contrast
// goes UP rather than down: every pair clears AA comfortably. Keep any retune on this shape —
// a low-alpha tint with an end-of-ramp text colour — rather than reaching back for mid steps.
const TYPE_TAG: Record<string, string> = {
  book: 'bg-indigo-500/10 text-indigo-900 dark:bg-indigo-400/15 dark:text-indigo-100',
  past_paper: 'bg-rose-500/10 text-rose-900 dark:bg-rose-400/15 dark:text-rose-100',
  guide: 'bg-emerald-500/10 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-100',
  video: 'bg-amber-500/10 text-amber-900 dark:bg-amber-400/15 dark:text-amber-100',
  other: 'bg-surface text-muted',
};

function ResourceCard({ resource }: { resource: ResourceView }) {
  const fallbackArt = TYPE_FALLBACK_ART[resource.type] ?? '/resource-art/other.svg';
  // Art precedence: curated `imageUrl` → a YouTube link's own thumbnail → the per-type SVG. The
  // middle rung is DERIVED from the video id in the resource's URL (owner 2026-08-28) rather than
  // stored, so it costs nothing, cannot go stale, and cannot be a guess. ResourceArt's onError
  // still backstops it: a thumbnail that 404s drops to the generic art like any other dead link.
  const art = resource.imageUrl ?? youtubeThumbnail(resource.url) ?? null;
  const tagTint = TYPE_TAG[resource.type] ?? TYPE_TAG.other;
  const rel = resource.isAffiliate
    ? 'sponsored nofollow noopener noreferrer'
    : 'nofollow noopener noreferrer';
  return (
    // role="listitem" on a wrapper — on the <a> it would replace the link role, so AT would
    // announce a nameless list item instead of a link (a11y).
    <div role="listitem" className="flex w-52 shrink-0 snap-start">
      <a
        href={resource.url}
        target="_blank"
        rel={rel}
        className={cn(
          'group/res flex w-full flex-col overflow-hidden rounded-[var(--radius-panel)]',
          'border border-border bg-surface-raised transition-colors hover:border-muted/50',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        )}
      >
        {/* SQUARE art box, 208×208 against the card's w-52, so the card runs ~1.6:1 portrait —
            the shape real cover art wants (the original h-24 letterbox cropped jackets to a
            strip). `imageUrl` has been on the DTO (and settable in admin) since `0020` but
            nothing public ever rendered it; this is where it lands.
            ⚠ The box is a FRAME, not a crop (owner 2026-08-26): the art is `object-contain` on
            a neutral `bg-surface` mat, so a portrait jacket renders tall, a 16:9 video still
            renders wide, and the leftover space is grey. Do not go back to `object-cover` — it
            forced every resource into the same square silhouette and cut the top off 2:3 book
            jackets; showing one of those whole under cover would need a ~312px box and a card
            twice as tall as it is wide. Shape IS information here: it tells you what kind of
            thing the link is before you read the tag — which is also why the generic fallback
            art (TYPE_FALLBACK_ART, via ResourceArt) is drawn per-type in per-type shapes rather
            than being one shared placeholder. The mat is unconditionally grey now that every
            card shows an image; a type tint behind contained art would ring it in colour and
            fight it. p-2.5 insets the art: edge-to-edge the image read as a bleed panel rather
            than a picture OF something, and its top corners were the card's own. */}
        <div className="flex h-52 shrink-0 items-center justify-center bg-surface p-2.5">
          <ResourceArt imageUrl={art} fallbackSrc={fallbackArt} />
        </div>
        <div className="flex flex-1 flex-col gap-2 p-3">
          {/* Type is a TAG now (owner 2026-08-26), so it reads as a peer of the Affiliate chip
              instead of loose grey text beside one. Both come from the shared Badge — the
              affiliate chip was hand-rolled brand-gold classes, which is exactly what the
              packages/ui rule exists to prevent (`gold` IS that recipe). */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className={tagTint}>{resourceTypeLabel(resource.type)}</Badge>
            {resource.isAffiliate && <Badge variant="gold">Affiliate</Badge>}
          </div>
          <p className="line-clamp-3 text-sm font-medium text-foreground">
            {resource.title}
            {/* The visible "Open ↗" row is gone (owner 2026-08-26) — the whole card is the link,
                so it was chrome restating the affordance. The new-tab warning it carried is not
                chrome, so it survives here for screen readers. */}
            <span className="sr-only"> (opens in a new tab)</span>
          </p>
        </div>
      </a>
    </div>
  );
}

export function ResourcesRow({ resources }: { resources: ResourceView[] }) {
  if (resources.length === 0) return null;
  const hasAffiliate = resources.some((r) => r.isAffiliate);

  return (
    <section aria-labelledby="resources-heading" className="grid grid-cols-1 gap-3">
      <h2 id="resources-heading" className="font-display text-xl text-foreground">
        Prep resources
      </h2>

      {hasAffiliate && (
        <p className="flex items-start gap-2 rounded-[var(--radius-field)] bg-surface px-3 py-2 text-xs leading-relaxed text-muted">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            Some links below are{' '}
            <strong className="font-medium text-foreground">affiliate links</strong> — if you buy
            through them, we may earn a small commission at no extra cost to you. It never affects
            what we list. As an Amazon Associate, we earn from qualifying purchases.{' '}
            <Link
              href="/affiliate-disclosure"
              className="font-medium text-foreground underline underline-offset-2 hover:text-brand-gold"
            >
              Learn more
            </Link>
            .
          </span>
        </p>
      )}

      <ScrollRow label="Prep resources">
        {resources.map((resource) => (
          <ResourceCard key={resource.id} resource={resource} />
        ))}
      </ScrollRow>
    </section>
  );
}
