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

/**
 * Full wordmark logo. Default height `h-7`; pass a height utility via `className` to resize
 * (tailwind-merge lets it override).
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className="inline-flex items-center">
      <img
        src="/brand/logo-light.png"
        alt="BeeCompete"
        width={821}
        height={150}
        className={cn('block h-7 w-auto dark:hidden', className)}
      />
      <img
        src="/brand/logo-dark.png"
        alt="BeeCompete"
        width={822}
        height={153}
        className={cn('hidden h-7 w-auto dark:block', className)}
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
    <span className="inline-flex items-center">
      <img
        src="/brand/mark-light.png"
        alt={alt}
        aria-hidden={label ? undefined : true}
        width={171}
        height={150}
        className={cn('block h-7 w-auto dark:hidden', className)}
      />
      <img
        src="/brand/mark-dark.png"
        alt={alt}
        aria-hidden={label ? undefined : true}
        width={166}
        height={138}
        className={cn('hidden h-7 w-auto dark:block', className)}
      />
    </span>
  );
}
