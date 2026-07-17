import { CheckCircle, Info, VerifiedSeal } from '@beecompete/ui';
import { formatDate } from '@/lib/dates';
import { isHostMaintained } from '@/lib/catalog-display';
import type { CompetitionDetail } from '@/lib/catalog-types';

// Trust & attribution panel (blueprints Page 3.4c, → DQ1/DQ13). R1-19: a competition is never
// "verified" — verification is an ORGANIZATION property. So the only "verified" language here is
// the organizer seal; the rest is the maintained-by line (derived from the org: host-maintained
// once the org is claimed/verified, else the Curation Team) + provenance. Maintained-by wording
// is LOCKED — "maintained", never "managed".

const SOURCE_LABELS: Record<string, string> = {
  curated: 'Curated by the BeeCompete team',
  import: 'Compiled from official sources',
  host_submitted: 'Submitted by the host',
  crowdsourced: 'Community-submitted',
};

// Qualitative confidence, not a raw percentage: "40% confidence" reads as alarming precision on
// a parent-facing page. Still exposes the provenance signal (DQ13), just in plain words.
function confidenceLabel(confidence: number): string {
  if (confidence >= 0.75) return 'high confidence';
  if (confidence >= 0.5) return 'moderate confidence';
  return 'details still being verified';
}

export function TrustPanel({ competition }: { competition: CompetitionDetail }) {
  const provenance = competition.provenance;
  const hostMaintained = isHostMaintained(competition);
  const orgVerified = competition.organizer?.verificationState === 'verified';
  const maintainer = hostMaintained ? competition.organizer!.name : 'the BeeCompete Curation Team';

  return (
    <section aria-label="Trust and attribution" className="grid gap-2.5 text-sm">
      {orgVerified && (
        <p className="flex items-center gap-2 font-medium text-foreground">
          <VerifiedSeal aria-hidden="true" weight="fill" className="size-4 shrink-0 text-success" />
          Verified organizer
        </p>
      )}

      {provenance?.source && (
        <p className="flex items-start gap-2 text-muted">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            {SOURCE_LABELS[provenance.source] ?? provenance.source}
            {provenance.confidence != null && (
              <> · {confidenceLabel(Number(provenance.confidence))}</>
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
