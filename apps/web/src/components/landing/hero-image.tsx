// Hero right half (owner 2026-08-15, supersedes decision #25's main + 2 satellite HeroCards):
// a single bottom-anchored cutout of a student with a trophy.
//
//  1. Stands on the hero's baseline — the subject is bottom-cropped in the source, so it reads as
//     grounded rather than floating. It sits flush with the bottom of the (viewport-tall) hero and
//     does NOT hang past it: the page shell's section gap is left intact so the spacing between
//     hero and Featured matches every other section boundary (#39).
//  2. Dissolves instead of ending on a hard cut. A linear alpha mask fades the lower part of the
//     cutout to nothing, so it settles into the page rather than stopping on a visible edge.
//  3. Grows as large as it can. Enlarged 2026-08-15 (owner) by dropping the fixed svh cap that
//     used to bind before the column did, so the cutout is now limited by whichever runs out
//     first: the column's width, or `--hero-available` (the height the header + shell padding
//     leave for the hero — declared on the hero <section> in page.tsx and inherited here).
//     That height cap is NOT optional. `max-h-full` cannot do this job: the hero is sized by
//     min-height, so a percentage max-height has no definite parent height to resolve against and
//     is ignored — on a short laptop (e.g. 1280x600) the image's width-derived height then pushed
//     the hero 135px past one screen, breaking the header+hero == one viewport rule.
//
// Hidden below md (#39): the phone layout stacks to one column, and the owner only wants the
// cutout where it can sit BESIDE the headline rather than under it. md (768px) is portrait-iPad,
// the narrowest width where the two-column hero still reads.
//
// The white studio background is knocked out of the source PNG (edge-connected flood fill), so
// the cutout sits correctly on BOTH grounds — light #fdfdfc and dark #262624 — with no plate.
// It is decorative (alt=""); the headline carries the meaning.

const FADE = 'linear-gradient(to bottom, #000 52%, rgb(0 0 0 / 0.45) 78%, transparent 100%)';

// Intrinsically-sized blank standing in for the cutout below md. `hidden` alone is NOT enough to
// stop the download: React emits a <link rel="preload"> for a fetchPriority="high" image, and
// preloads ignore CSS entirely — so phones were pulling the full 145 KB for something they never
// render. Hanging the real file off a media-gated <source> is what actually gates the request.
// The media query is in rem to stay locked to Tailwind's `md:` (48rem); a px query would drift
// apart from it whenever the root font size isn't 16px.
const BLANK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='784' height='826'/%3E";

export function HeroImage() {
  // NO negative margin here — deliberately (#70). The cutout used to bleed rightward into the
  // gutter to gain width (lg:-mr-4 / xl:-mr-14 / 2xl:-mr-38), but a one-sided bleed is exactly
  // what made the hero look shifted right: at 1920 it left 400px of space to the left of the text
  // against 121px to the right of the cutout. The extra width now comes from the hero SECTION
  // breaking out symmetrically (see page.tsx), which widens both columns and keeps the two outer
  // insets equal at every size. Re-adding any `-mr` here re-breaks that balance.
  // Both were 8px larger before #51; pulling them in is the "more padding on its right" half of
  // that change, paired with 8px off the column gap in page.tsx so the cutout SHIFTS inward
  // instead of shrinking. The two must move together — see the note on the hero <section>.
  // The xl step is safe by arithmetic, not by luck. With the box centred, the gap left over is
  // (viewport − 1152) / 2 − 40; at the xl breakpoint itself (1280px) that is exactly 24px, and it
  // only grows on wider screens. Tying it to `xl:` is what guarantees it — a bleed this size
  // applied any lower would run past the viewport and start a horizontal scrollbar.
  // self-end is what keeps the bottom pinned while it grows upward ("don't move where the bottom
  // starts from"); max-h keeps it inside the one-screen hero, which is the binding limit at
  // 1280x800 (see the height-cap note in page-blueprints #46).
  return (
    <div className="pointer-events-none relative hidden self-end md:flex md:justify-center lg:justify-end">
      {/* Plain <picture>/<img>, not next/image: the optimizer needs sharp at runtime, which the
          standalone node:20-alpine runner does not carry (apps/web/Dockerfile). The asset is
          pre-optimised instead — quantised PNG, ~145 KB, served straight from public/. */}
      <picture>
        <source media="(min-width: 48rem)" srcSet="/landing/hero-section-image-1.png" />
        <img
          src={BLANK}
          alt=""
          width={784}
          height={826}
          // Hero LCP element on the screens that show it — fetch eagerly, not lazily.
          fetchPriority="high"
          // max-w is min(100%, 49rem): 49rem == the asset's natural 784px. #69 widens this
          // wrapper on large monitors, and without the second term the cutout would follow it and
          // upscale past native into blur. The height cap alone does not prevent that — it only
          // binds once the hero is short. This is the hard ceiling on cutout size; raising it
          // requires a higher-resolution source, not a bigger number.
          className="max-h-(--hero-available) w-auto max-w-[min(100%,49rem)] animate-rise-in object-contain object-bottom [animation-delay:150ms]"
          // Inline rather than Tailwind's mask-* utilities so the stop positions are explicit and
          // the -webkit- prefix ships for Safari < 16.4.
          style={{ maskImage: FADE, WebkitMaskImage: FADE }}
        />
      </picture>
    </div>
  );
}
