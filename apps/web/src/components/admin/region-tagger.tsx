'use client';

import { useState, useTransition } from 'react';
import { Button, Checkbox, useToast } from '@beecompete/ui';
import { setEditionRegions } from '@/app/admin/competitions/[id]/editions/actions';
import type { Region } from '@/lib/admin-types';

/** Edition-level region tags (Q3): tick the regions this edition covers, save the whole set. */
export function RegionTagger({
  competitionId,
  editionId,
  allRegions,
  selectedIds,
}: {
  competitionId: string;
  editionId: string;
  allRegions: Region[];
  selectedIds: string[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (allRegions.length === 0) {
    return (
      <p className="text-sm text-muted">
        No regions defined yet — add them under Categories → Regions first.
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {allRegions.map((r) => (
          <li key={r.id}>
            <Checkbox
              checked={selected.has(r.id)}
              onChange={() => toggle(r.id)}
              label={`${r.name} (${r.level.toLowerCase()})`}
            />
          </li>
        ))}
      </ul>
      <div>
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                await setEditionRegions(competitionId, editionId, [...selected]);
                toast({ title: 'Regions saved', tone: 'success' });
              } catch (e) {
                toast({ title: e instanceof Error ? e.message : 'Save failed', tone: 'error' });
              }
            })
          }
        >
          Save regions
        </Button>
      </div>
    </div>
  );
}
