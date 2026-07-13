import type { ComponentType } from 'react';
import { Flag, CircleHelp, Sparkles, VerifiedSeal } from '../icons';
import { cn } from '../lib/cn';
import { Badge } from './badge';
import type { BadgeVariant } from './badge';

/**
 * TrustBadge (R1-9, DQ13) — the LISTING's trust tier, shown consistently on cards + the detail
 * trust panel. Distinct from the organizer's verified seal (an ORG-level signal on the card's
 * organizer row): this is about the listing record's trust state.
 *
 * Tiers are the canonical glossary progression — Curated → Claimed → Verified → Unverified.
 * `curated` is the R1 baseline (BeeCompete seeds every listing and keeps it current), so callers
 * typically hide it on dense surfaces and show only the elevated/caution tiers. The one-line
 * `blurb` is the source of truth for what each tier means — rendered as visible text in the
 * detail trust panel and as the badge's native title hint elsewhere.
 */

export type TrustTier = 'curated' | 'claimed' | 'verified' | 'unverified';

type IconType = ComponentType<{
  className?: string;
  weight?: 'regular' | 'bold' | 'fill' | 'duotone';
  'aria-hidden'?: boolean | 'true' | 'false';
}>;

export interface TrustTierMeta {
  tier: TrustTier;
  label: string;
  blurb: string;
  variant: BadgeVariant;
  icon: IconType;
}

const TIERS: Record<TrustTier, TrustTierMeta> = {
  verified: {
    tier: 'verified',
    label: 'Verified',
    blurb: 'The organizer’s identity has been verified by BeeCompete.',
    variant: 'verified',
    icon: VerifiedSeal,
  },
  claimed: {
    tier: 'claimed',
    label: 'Host-claimed',
    blurb: 'The organizer has claimed this listing.',
    variant: 'neutral',
    icon: Flag,
  },
  curated: {
    tier: 'curated',
    label: 'Curated',
    blurb: 'Compiled and kept current by the BeeCompete curation team.',
    variant: 'gold',
    icon: Sparkles,
  },
  unverified: {
    tier: 'unverified',
    label: 'Unverified',
    blurb: 'Not yet reviewed by our team — some details may be incomplete.',
    variant: 'outline',
    icon: CircleHelp,
  },
};

/** Tier metadata for a (public, lowercase) verification-state token; unknown → unverified. */
export function trustTierMeta(state: string): TrustTierMeta {
  return TIERS[state as TrustTier] ?? TIERS.unverified;
}

/** True for the elevated host signals (claimed/verified) — surfaces worth calling out on cards. */
export function isElevatedTier(state: string): boolean {
  return state === 'verified' || state === 'claimed';
}

export interface TrustBadgeProps {
  tier: string;
  /** Native hover/title hint with the tier blurb (server-safe; no JS). Default true. */
  titleHint?: boolean;
  className?: string;
}

export function TrustBadge({ tier, titleHint = true, className }: TrustBadgeProps) {
  const meta = trustTierMeta(tier);
  const Icon = meta.icon;
  return (
    <Badge
      variant={meta.variant}
      className={cn('gap-1', className)}
      title={titleHint ? meta.blurb : undefined}
    >
      <Icon
        aria-hidden="true"
        weight={meta.tier === 'verified' ? 'fill' : 'regular'}
        className="size-3.5"
      />
      {meta.label}
    </Badge>
  );
}
