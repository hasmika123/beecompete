// Presentational current-vs-proposed table — no 'use client': rendered by the CorrectionReview
// client component (pending proposals) AND directly by the server page (read-only reviewed view).

const show = (value: unknown) =>
  value === null || value === undefined ? '—' : JSON.stringify(value);

export function CorrectionDiffTable({
  payload,
  currentValues,
}: {
  payload: Record<string, unknown>;
  currentValues: Record<string, unknown> | null;
}) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="px-3 py-2 font-medium">Field</th>
            <th className="px-3 py-2 font-medium">Current</th>
            <th className="px-3 py-2 font-medium">Proposed</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(payload).map((field) => (
            <tr key={field} className="border-b border-border last:border-0">
              <td className="px-3 py-2 font-medium">{field}</td>
              <td className="px-3 py-2 text-muted">{show(currentValues?.[field])}</td>
              <td className="px-3 py-2">{show(payload[field])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
