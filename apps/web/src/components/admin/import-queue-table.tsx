'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import {
  Alert,
  Badge,
  Button,
  Check,
  Checkbox,
  EmptyState,
  Textarea,
  X,
  useConfirm,
  useToast,
} from '@beecompete/ui';
import { ConfidenceMeter } from '@/components/admin/confidence-meter';
import { ImportOriginBadge, ReviewStatusBadge } from '@/components/admin/status-badges';
import { bulkReviewImports } from '@/app/admin/import-records/actions';
import { formatDate, keyDateZone } from '@/lib/dates';
import { blocksBulkApprove, queueDuplicateBadge } from '@/lib/duplicates';
import { summarizeImportRow } from '@/lib/import-queue';
import type { BulkOutcome, Category, ImportRecord, Organization } from '@/lib/admin-types';

/**
 * The import queue table: triage facts per row, multi-select, and one decision applied to many.
 *
 * WHY BULK APPROVE IS OFFERED AT ALL. Seeding needs 200+ listings, and a large share of extractions
 * are simply correct; making a curator open each one to click the same button is the difference
 * between a day's work and a week's. It is still a real decision, so this is deliberately not a
 * "select all, approve" button with no friction: the confirm spells out that per-record review is
 * being skipped, it counts the rows already known to collide with a live slug, and every failure
 * comes back named and linked instead of vanishing into a toast.
 */
export function ImportQueueTable({
  records,
  status,
  categories,
  organizations,
}: {
  records: ImportRecord[];
  /** Only PENDING rows can be decided — the other tabs render read-only. */
  status: string;
  categories: Category[];
  organizations: Organization[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [failures, setFailures] = useState<BulkOutcome[]>([]);
  const [running, startBulk] = useTransition();
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const { toast } = useToast();

  const categoryName = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? (byId.get(id) ?? 'unknown category') : null);
  }, [categories]);
  const orgName = useMemo(() => {
    const byId = new Map(organizations.map((o) => [o.id, o.name]));
    return (id: string) => byId.get(id) ?? 'linked organization';
  }, [organizations]);

  const rows = useMemo(
    () => records.map((record) => ({ record, summary: summarizeImportRow(record.payload) })),
    [records],
  );
  const selectable = status === 'PENDING';
  const selectedIds = [...selected].filter((id) => records.some((r) => r.id === id));
  const allSelected = records.length > 0 && selectedIds.length === records.length;
  const titleOf = (id: string) => rows.find((r) => r.record.id === id)?.summary.title ?? id;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(records.map((r) => r.id)));

  const run = async (action: 'APPROVE' | 'REJECT') => {
    const selectedNow = selectedIds;
    if (selectedNow.length === 0) return;
    const approving = action === 'APPROVE';
    // Rows flagged as a possible duplicate (DQ4) are LEFT OUT of a bulk approve rather than sent
    // to fail: bulk skips the review form, and the form is the only place a curator can say "not
    // a duplicate". Rejecting in bulk is unaffected — a duplicate is exactly what gets rejected.
    const flagged = approving
      ? selectedNow.filter((id) => {
          const record = records.find((r) => r.id === id);
          return record !== undefined && blocksBulkApprove(record);
        })
      : [];
    const ids = selectedNow.filter((id) => !flagged.includes(id));
    if (ids.length === 0) {
      toast({
        title: 'Every selected record is flagged as a possible duplicate',
        description: 'Open each one to review it — the form can confirm it through, bulk cannot.',
        tone: 'error',
      });
      return;
    }
    const ok = await confirm({
      title: approving
        ? `Approve ${ids.length} record${plural(ids)}?`
        : `Reject ${ids.length} record${plural(ids)}?`,
      message: approving
        ? `Each one is created exactly as extracted — nobody opens the review form for these. ${
            flagged.length > 0
              ? `${flagged.length} flagged as a possible duplicate ${flagged.length === 1 ? 'is' : 'are'} left out — review ${flagged.length === 1 ? 'it' : 'those'} individually. `
              : ''
          }Anything that fails validation stays pending and is listed back to you.`
        : 'Rejection is final. None of these can be reopened for approval.',
      confirmLabel: approving ? `Approve ${ids.length}` : 'Reject all',
      tone: approving ? 'default' : 'danger',
    });
    if (!ok) return;

    startBulk(async () => {
      try {
        const result = await bulkReviewImports(ids, action, note);
        setFailures(result.results.filter((r) => !r.ok));
        setSelected(new Set());
        setNote('');
        toast({
          title:
            result.failed === 0
              ? `${result.succeeded} record${result.succeeded === 1 ? '' : 's'} ${approving ? 'approved' : 'rejected'}`
              : `${result.succeeded} done, ${result.failed} still need attention`,
          tone: result.failed === 0 ? 'success' : 'error',
        });
        router.refresh();
      } catch (e) {
        toast({ title: e instanceof Error ? e.message : 'Bulk review failed', tone: 'error' });
      }
    });
  };

  if (records.length === 0) {
    return <EmptyState title={`No ${status.toLowerCase()} records.`} />;
  }

  return (
    <div className="grid gap-4">
      {dialog}

      {/* Failures survive the refresh that clears the selection — a bulk run whose problems
          scrolled away as a toast would leave nobody knowing which rows still need a human. */}
      {failures.length > 0 && (
        <Alert tone="warning">
          <div className="grid gap-1.5">
            <p className="font-medium">
              {failures.length} record{plural(failures)} could not be reviewed and stayed pending:
            </p>
            <ul className="grid gap-1 text-sm">
              {failures.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/admin/import-records/${f.id}`}
                    className="font-medium underline underline-offset-2"
                  >
                    {titleOf(f.id)}
                  </Link>
                  {f.error ? ` — ${f.error}` : null}
                </li>
              ))}
            </ul>
          </div>
        </Alert>
      )}

      {selectable && selectedIds.length > 0 && (
        <div className="sticky top-2 z-10 grid gap-3 rounded-[var(--radius-panel)] border border-border bg-surface-raised p-4 shadow-[var(--shadow-lift)]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-foreground">
              {selectedIds.length} selected
            </span>
            <Button size="sm" disabled={running} onClick={() => void run('APPROVE')}>
              <Check aria-hidden="true" className="size-4" />{' '}
              {running ? 'Working…' : 'Approve selected'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={running}
              onClick={() => void run('REJECT')}
            >
              <X aria-hidden="true" className="size-4" /> Reject selected
            </Button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs text-muted hover:text-foreground hover:underline"
            >
              Clear selection
            </button>
          </div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Note for the rejected records (optional; ignored when approving)"
            aria-label="Bulk review note"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface/50 text-left">
              {selectable && (
                <th scope="col" className="w-10 px-4 py-2.5">
                  <Checkbox
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select every record on this page"
                  />
                </th>
              )}
              {['Record', 'Origin', 'Category', 'Organizer', 'Edition', 'Confidence'].map((h) => (
                <th key={h} scope="col" className="px-4 py-2.5 font-medium text-muted">
                  {h}
                </th>
              ))}
              <th scope="col" className="px-4 py-2.5 text-right font-medium text-muted">
                {status === 'PENDING' ? 'Queued' : 'Reviewed'}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ record, summary }) => (
              <tr
                key={record.id}
                className="border-b border-border align-top last:border-0 hover:bg-surface/40"
              >
                {selectable && (
                  <td className="px-4 py-2.5">
                    <Checkbox
                      checked={selected.has(record.id)}
                      onChange={() => toggle(record.id)}
                      aria-label={`Select ${summary.title}`}
                    />
                  </td>
                )}
                <td className="px-4 py-2.5">
                  <Link
                    href={`/admin/import-records/${record.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {summary.title}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    {summary.slug && (
                      <code className="font-mono text-xs text-muted">{summary.slug}</code>
                    )}
                    <DuplicateBadges record={record} />
                    {status !== 'PENDING' && <ReviewStatusBadge status={record.status} />}
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <ImportOriginBadge origin={record.origin} />
                </td>
                <td className="px-4 py-2.5 text-muted">
                  {categoryName(summary.categoryId) ?? <Missing>none</Missing>}
                </td>
                <td className="px-4 py-2.5 text-muted">
                  {summary.organizerOrgId ? (
                    orgName(summary.organizerOrgId)
                  ) : summary.organizerName ? (
                    summary.organizerName
                  ) : (
                    <Missing>none</Missing>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {summary.hasEdition ? (
                    <div className="grid gap-0.5">
                      <span className="text-muted">{summary.cycleLabel ?? 'unlabelled'}</span>
                      <DeadlineChip summary={summary} />
                    </div>
                  ) : (
                    <Missing>no edition</Missing>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <ConfidenceMeter value={record.confidence} />
                </td>
                <td className="px-4 py-2.5 text-right text-xs text-muted">
                  {formatDate(record.reviewedAt ?? record.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * The row's duplicate flags (DQ4): the strongest catalog match, worded by lib/duplicates, and a
 * count of other pending records that look like the same competition — so two people who queued
 * the same page see each other before either approves.
 */
function DuplicateBadges({ record }: { record: ImportRecord }) {
  const badge = queueDuplicateBadge(record);
  return (
    <>
      {badge && (
        <Badge variant={badge.variant} title={record.duplicate?.name}>
          {badge.label}
        </Badge>
      )}
      {record.pendingTwins > 0 && (
        <Badge variant="outline">also pending ×{record.pendingTwins}</Badge>
      )}
    </>
  );
}

/** A fact the extraction didn't produce. Muted-italic, never an empty cell — absence is a signal. */
function Missing({ children }: { children: string }) {
  return <span className="text-xs text-muted italic">{children}</span>;
}

function DeadlineChip({ summary }: { summary: ReturnType<typeof summarizeImportRow> }) {
  const { deadline } = summary;
  if (deadline.kind === 'none') {
    return <span className="text-xs text-amber-700 dark:text-amber-400">no deadline</span>;
  }
  if (deadline.kind === 'tbd') {
    return <span className="text-xs text-muted">deadline TBD</span>;
  }
  return (
    <span className="text-xs text-muted">
      {formatDate(deadline.startsAt, keyDateZone(deadline.timezone))}
    </span>
  );
}

const plural = (list: unknown[]) => (list.length === 1 ? '' : 's');
