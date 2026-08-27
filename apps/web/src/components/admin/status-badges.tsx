import { Badge } from '@beecompete/ui';
import type { BadgeVariant } from '@beecompete/ui';

const VERIFICATION_VARIANT: Record<string, BadgeVariant> = {
  VERIFIED: 'verified',
  CURATED: 'gold',
  CLAIMED: 'neutral',
  UNVERIFIED: 'outline',
};

export function VerificationBadge({ state }: { state: string }) {
  return <Badge variant={VERIFICATION_VARIANT[state] ?? 'outline'}>{state.toLowerCase()}</Badge>;
}

const REVIEW_VARIANT: Record<string, BadgeVariant> = {
  PENDING: 'gold',
  APPROVED: 'verified',
  REJECTED: 'danger',
};

/** Shared by the review queues (import records + corrections) — same status lifecycle. */
export function ReviewStatusBadge({ status }: { status: string }) {
  return <Badge variant={REVIEW_VARIANT[status] ?? 'outline'}>{status.toLowerCase()}</Badge>;
}

/**
 * Import-record origin (migration 0013): a public Request-a-Competition submission gets a
 * highlighted badge so curators apply extra skepticism (unvetted, possibly spam); the pipeline
 * baseline stays muted text to avoid wall-of-sameness (same pattern as the trust badges hiding
 * the curated baseline).
 */
export function ImportOriginBadge({ origin }: { origin: 'PIPELINE' | 'USER_REQUEST' }) {
  return origin === 'USER_REQUEST' ? (
    <Badge variant="gold">user request</Badge>
  ) : (
    <span className="text-xs text-muted">pipeline</span>
  );
}

/**
 * A listing with no live edition is a ZOMBIE: the readiness gate (domain-model §8a) hides it from
 * the public catalog, so it is invisible rather than wrong — unfinished work that would otherwise
 * only be findable by opening each listing. Renders nothing when the flag wasn't computed (null)
 * or when an edition exists; a badge on every healthy row would be wall-of-sameness.
 */
export function MissingEditionBadge({ hasLiveEdition }: { hasLiveEdition: boolean | null }) {
  return hasLiveEdition === false ? <Badge variant="danger">no edition</Badge> : null;
}

/** Archived vs live — quick scan column in tables. */
export function ArchivedBadge({ archivedAt }: { archivedAt: string | null }) {
  return archivedAt ? (
    <Badge variant="outline">archived</Badge>
  ) : (
    <Badge variant="neutral">live</Badge>
  );
}

const LISTING_VARIANT: Record<string, { variant: BadgeVariant; label: string }> = {
  DRAFT: { variant: 'outline', label: 'draft' },
  IN_REVIEW: { variant: 'gold', label: 'in review' },
  PUBLISHED: { variant: 'verified', label: 'published' },
  UNLISTED: { variant: 'neutral', label: 'unlisted' },
};

/**
 * §8a lifecycle in one glance. Archived wins the slot — an archived listing's stored
 * listing_status is irrelevant (the gate auto-unlists it), so showing both would imply a
 * "published but archived" state that cannot exist publicly.
 */
export function ListingStatusBadge({
  listingStatus,
  archivedAt,
}: {
  listingStatus: string;
  archivedAt: string | null;
}) {
  if (archivedAt) return <Badge variant="outline">archived</Badge>;
  const v = LISTING_VARIANT[listingStatus] ?? {
    variant: 'outline' as BadgeVariant,
    label: listingStatus,
  };
  return <Badge variant={v.variant}>{v.label}</Badge>;
}
