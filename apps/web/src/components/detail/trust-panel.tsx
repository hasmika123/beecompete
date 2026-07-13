import { CheckCircle, Info, TrustBadge, trustTierMeta } from '@beecompete/ui';
import { formatDate } from '@/lib/dates';
import type { CompetitionDetail } from '@/lib/catalog-types';

// Trust & attribution panel (blueprints Page 3.4c, → DQ1/DQ13): the listing trust badge + what
// it means · source + confidence · "Last verified …" · maintained-by line. The badge + tier copy
// come from the shared `TrustBadge`/`trustTierMeta` (R1-9) so cards and the detail page agree.
// Maintained-by wording is LOCKED — "maintained", never "managed"; it flips from the Curation
// Team to the host org after claim.

const SOURCE_LABELS: Record<string, string> = {
  curated: 'Curated by the BeeCompete team',
  import: 'Compiled from official sources',
  host_submitted: 'Submitted by the host',
  crowdsourced: 'Community-submitted',
};

export function TrustPanel({ competition }: { competition: CompetitionDetail }) {
  const meta = trustTierMeta(competition.verificationState);
  const provenance = competition.provenance;
  const claimed =
    (competition.verificationState === 'claimed' || competition.verificationState === 'verified') &&
    competition.organizer != null;
  const maintainer = claimed ? competition.organizer!.name : 'the BeeCompete Curation Team';

  return (
    <section aria-label="Trust and attribution" className="grid gap-2.5 text-sm">
      <div className="flex items-center gap-2">
        <TrustBadge tier={competition.verificationState} titleHint={false} />
      </div>
      <p className="text-muted">{meta.blurb}</p>

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
