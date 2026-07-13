import { Badge, CheckCircle, Info, VerifiedSeal } from '@beecompete/ui';
import type { BadgeVariant } from '@beecompete/ui';
import { formatDate } from '@/lib/dates';
import type { CompetitionDetail } from '@/lib/catalog-types';

// Trust & attribution panel (blueprints Page 3.4c, → DQ1/DQ13): tier badge · source +
// confidence · "Last verified …" · maintained-by line. The badge tier here is a first pass;
// R1-9 owns the full Curated/Verified trust-badge system. Maintained-by wording is LOCKED —
// "maintained", never "managed"; it flips from the Curation Team to the host org after claim.

const UNVERIFIED: { label: string; variant: BadgeVariant } = {
  label: 'Unverified',
  variant: 'outline',
};

const TIER: Record<string, { label: string; variant: BadgeVariant }> = {
  verified: { label: 'Verified', variant: 'verified' },
  curated: { label: 'Curated', variant: 'gold' },
  claimed: { label: 'Host-claimed', variant: 'neutral' },
  unverified: UNVERIFIED,
};

const SOURCE_LABELS: Record<string, string> = {
  curated: 'Curated by the BeeCompete team',
  import: 'Compiled from official sources',
  host_submitted: 'Submitted by the host',
  crowdsourced: 'Community-submitted',
};

export function TrustPanel({ competition }: { competition: CompetitionDetail }) {
  const tier = TIER[competition.verificationState] ?? UNVERIFIED;
  const provenance = competition.provenance;
  const claimed =
    (competition.verificationState === 'claimed' || competition.verificationState === 'verified') &&
    competition.organizer != null;
  const maintainer = claimed ? competition.organizer!.name : 'the BeeCompete Curation Team';

  return (
    <section aria-label="Trust and attribution" className="grid gap-2.5 text-sm">
      <div className="flex items-center gap-2">
        <Badge variant={tier.variant}>
          {competition.verificationState === 'verified' && (
            <VerifiedSeal aria-hidden="true" weight="fill" className="size-3.5" />
          )}
          {tier.label}
        </Badge>
      </div>

      {provenance?.source && (
        <p className="flex items-start gap-2 text-muted">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            {SOURCE_LABELS[provenance.source] ?? provenance.source}
            {provenance.confidence != null && (
              <> · {Math.round(Number(provenance.confidence) * 100)}% confidence</>
            )}
          </span>
        </p>
      )}

      {provenance?.lastVerifiedAt && (
        <p className="flex items-center gap-2 text-muted">
          <CheckCircle aria-hidden="true" className="size-4 shrink-0 text-success" />
          Last verified {formatDate(provenance.lastVerifiedAt)}
        </p>
      )}

      <p className="text-xs text-muted">Listing maintained by {maintainer}.</p>
    </section>
  );
}
