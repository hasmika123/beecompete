'use client';

import { useState, useTransition } from 'react';
import { Button, useToast } from '@beecompete/ui';
import { RegionPicker } from '@/components/admin/region-picker';
import { setEditionRegions } from '@/app/admin/competitions/[id]/editions/actions';
import type { Region } from '@/lib/admin-types';

/**
 * Edition-level region tags (Q3): pick the regions this edition covers, save the whole set.
 * Rendering is the shared grouped/searchable RegionPicker (sweep item 22); the edition's scope
 * level feeds its soft assist.
 */
export function RegionTagger({
  competitionId,
  editionId,
  allRegions,
  selectedIds,
  scopeLevel,
}: {
  competitionId: string;
  editionId: string;
  allRegions: Region[];
  selectedIds: string[];
  scopeLevel?: string;
}) {
  const [selected, setSelected] = useState<string[]>(selectedIds);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

  return (
    <div className="grid gap-4">
      <RegionPicker
        regions={allRegions}
        selectedIds={selected}
        onToggle={toggle}
        scopeLevel={scopeLevel}
      />
      {allRegions.length > 0 && (
        <div>
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await setEditionRegions(competitionId, editionId, selected);
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
      )}
    </div>
  );
}
