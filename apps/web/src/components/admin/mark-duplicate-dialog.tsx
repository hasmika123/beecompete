'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Badge, Button, Input, Modal, useToast } from '@beecompete/ui';
import { markDuplicate, searchCompetitions } from '@/app/admin/competitions/actions';
import type { Competition } from '@/lib/admin-types';

/**
 * "Mark as duplicate of…" (DQ4 PR 2). The curator names the listing that SURVIVES; this one is
 * archived and linked to it, so its public URL redirects there instead of going dead. Same
 * Modal + list-of-rows shape as the organizer resolver — pick a row, confirm.
 *
 * Content is not moved (that is DQ4 Phase 2), and the dialog says so: anything worth keeping is
 * copied across by hand before the row is retired.
 */
export function MarkDuplicateDialog({
  id,
  name,
  open,
  onClose,
}: {
  id: string;
  name: string;
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Competition[]>([]);
  const [chosen, setChosen] = useState<Competition | null>(null);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  // Debounced lookup; a late reply for an older query is dropped.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const found = await searchCompetitions(q);
        // Never offer itself, an archived row, or another retired duplicate as the canonical —
        // the server refuses all three; hiding them keeps the list to real choices.
        if (live) {
          setResults(
            found.filter(
              (c) => c.id !== id && c.archivedAt === null && !c.duplicateOfCompetitionId,
            ),
          );
        }
      } catch {
        if (live) setResults([]);
      }
    }, 350);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query, id]);

  const close = () => {
    setQuery('');
    setResults([]);
    setChosen(null);
    onClose();
  };

  const confirm = () => {
    if (!chosen) return;
    const canonical = chosen;
    startTransition(async () => {
      try {
        await markDuplicate(id, canonical.id);
        toast({ title: `Retired as a duplicate of ${canonical.name}`, tone: 'success' });
        close();
        router.refresh();
      } catch (e) {
        toast({
          title: e instanceof Error ? e.message : 'Could not mark as duplicate',
          tone: 'error',
        });
      }
    });
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Mark as a duplicate of…"
      description={`“${name}” will be archived and its public URL will redirect permanently to the listing you pick. Nothing is moved across — copy anything worth keeping first.`}
      className="max-w-lg"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={confirm} disabled={!chosen || pending}>
            {pending
              ? 'Retiring…'
              : chosen
                ? `Retire in favour of “${chosen.name}”`
                : 'Pick a listing'}
          </Button>
        </div>
      }
    >
      <div className="grid gap-3">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setChosen(null);
          }}
          placeholder="Search listings by name…"
          aria-label="Search listings by name"
          autoFocus
        />
        {results.length > 0 && (
          <ul className="grid gap-2">
            {results.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setChosen(c)}
                  aria-pressed={chosen?.id === c.id}
                  className={`flex w-full flex-col items-start gap-0.5 rounded-[var(--radius-field)] border p-3 text-left transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                    chosen?.id === c.id
                      ? 'border-foreground'
                      : 'border-border hover:border-muted/50'
                  }`}
                >
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                    {c.name}
                    {c.listingStatus !== 'PUBLISHED' && (
                      <Badge variant="outline">{c.listingStatus.toLowerCase()}</Badge>
                    )}
                  </span>
                  <span className="font-mono text-xs text-muted">/c/{c.slug}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {query.trim().length >= 2 && results.length === 0 && (
          <p className="text-sm text-muted">No live listing matches that.</p>
        )}
        {chosen && (
          <Alert tone="warning">
            /c/{'{'}this slug{'}'} → /c/{chosen.slug}, permanently. Restore undoes it.
          </Alert>
        )}
      </div>
    </Modal>
  );
}
