import { Card, CheckCircle, Warning } from '@beecompete/ui';
import type { HealthCheck } from '@/lib/listing-health';

/** "Listing health" card — a completeness checklist on the admin competition Details tab. */
export function ListingHealth({ checks }: { checks: HealthCheck[] }) {
  const failing = checks.filter((c) => !c.ok).length;

  return (
    <Card className="mb-6 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Listing health</h2>
        {failing === 0 ? (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-success">
            <CheckCircle aria-hidden="true" weight="fill" className="size-4" /> Complete
          </span>
        ) : (
          <span className="text-sm text-muted">
            {failing} of {checks.length} to finish
          </span>
        )}
      </div>
      <ul className="grid gap-1.5">
        {checks.map((c) => (
          <li key={c.key} className="flex items-center gap-2 text-sm">
            {c.ok ? (
              <CheckCircle
                aria-hidden="true"
                weight="fill"
                className="size-4 shrink-0 text-success"
              />
            ) : (
              <Warning
                aria-hidden="true"
                weight="fill"
                className="size-4 shrink-0 text-brand-gold"
              />
            )}
            <span className={c.ok ? 'text-muted' : 'text-foreground'}>{c.label}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
