import { cn } from '../lib/cn';

// Official BeeCompete brand art. The files are raster PNGs served from the consuming app's
// `/brand/` path (apps/web/public/brand). Each logo has a light- and dark-mode variant: both
// sit in the DOM and CSS swaps them via the `.dark` class (theme is class-based, next-themes),
// so the swap is SSR-safe and flash-free — no useTheme, no hydration gap. "light"/"dark" name
// the MODE the art is for: `*-light` is dark-inked art for light backgrounds, `*-dark` is the
// light art for dark backgrounds.
//
// Accessibility: only the visible (non-`display:none`) image is in the a11y tree, so giving BOTH
// variants the same `alt` yields exactly one announcement in either theme. When the logo sits in
// a link that already carries an `aria-label` (header, admin rail), that label wins and the alt
// isn't doubled.
//
// ⚠ `shrink-0 max-w-none` on the images and `shrink-0` on the wrapper are load-bearing, not
// decoration: without them the mobile header rendered the wordmark 100x30 against its natural
// 164x30 ratio — visibly squashed. TWO separate mechanisms had to be disabled, which is why
// dropping either half brings the squash back:
//   * flex shrink — both call sites put the logo in a flex row, so the wrapper and the image are
//     flex items and compress once the row runs out of room;
//   * Preflight's `img { max-width: 100% }` — that clamps the image to whatever width its parent
//     ended up with, and it applies even after the image itself has stopped shrinking, so
//     `shrink-0` alone left the img pinned to a squeezed wrapper.
// `w-auto` does neither of those: it only says "derive width from the height", which is exactly
// what gets overridden. Height utilities remain the single supported way to resize this.

/**
 * Full wordmark logo. Default height `h-7`; pass a height utility via `className` to resize
 * (tailwind-merge lets it override).
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className="inline-flex shrink-0 items-center">
      <img
        src="/brand/logo-light.png"
        alt="BeeCompete"
        width={821}
        height={150}
        className={cn('block h-7 w-auto max-w-none shrink-0 dark:hidden', className)}
      />
      <img
        src="/brand/logo-dark.png"
        alt="BeeCompete"
        width={822}
        height={153}
        className={cn('hidden h-7 w-auto max-w-none shrink-0 dark:block', className)}
      />
    </span>
  );
}

/**
 * Icon-only brand mark (no wordmark) — for compact spots like a collapsed rail or an avatar.
 * Decorative by default (empty alt); pass `label` to give it an accessible name when it stands
 * alone as the only content of a link/button.
 */
export function LogoMark({ className, label }: { className?: string; label?: string }) {
  const alt = label ?? '';
  return (
    <span className="inline-flex shrink-0 items-center">
      <img
        src="/brand/mark-light.png"
        alt={alt}
        aria-hidden={label ? undefined : true}
        width={171}
        height={150}
        className={cn('block h-7 w-auto max-w-none shrink-0 dark:hidden', className)}
      />
      <img
        src="/brand/mark-dark.png"
        alt={alt}
        aria-hidden={label ? undefined : true}
        width={166}
        height={138}
        className={cn('hidden h-7 w-auto max-w-none shrink-0 dark:block', className)}
      />
    </span>
  );
}
