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

const IMPORT_VARIANT: Record<string, BadgeVariant> = {
  PENDING: 'gold',
  APPROVED: 'verified',
  REJECTED: 'danger',
};

export function ImportStatusBadge({ status }: { status: string }) {
  return <Badge variant={IMPORT_VARIANT[status] ?? 'outline'}>{status.toLowerCase()}</Badge>;
}

/** Archived vs live — quick scan column in tables. */
export function ArchivedBadge({ archivedAt }: { archivedAt: string | null }) {
  return archivedAt ? (
    <Badge variant="outline">archived</Badge>
  ) : (
    <Badge variant="neutral">live</Badge>
  );
}
