'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import {
  Alert,
  Button,
  Check,
  FormField,
  Input,
  Pencil,
  Plus,
  Trash,
  X,
  useConfirm,
  useToast,
} from '@beecompete/ui';
import { NativeSelect, enumLabel, enumOptions } from '@/components/admin/native-select';
import { createRegion, deleteRegion, updateRegion } from '@/app/admin/regions/actions';
import { REGION_LEVELS, type FormState, type Region } from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

/** Region CRUD: a create row on top + an editable table (inline edit + confirmed delete). */
export function RegionAdmin({ regions }: { regions: Region[] }) {
  const [state, formAction, creating] = useActionState(createRegion, INITIAL);
  const createRef = useRef<HTMLFormElement>(null);
  const nameById = new Map(regions.map((r) => [r.id, r.name]));
  const [editingId, setEditingId] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();
  const { toast } = useToast();

  useEffect(() => {
    if (state.ok) {
      toast({ title: 'Region added', tone: 'success' });
      createRef.current?.reset();
    }
  }, [state.ok, toast]);

  return (
    <div className="grid gap-5">
      {dialog}

      <form
        ref={createRef}
        action={formAction}
        className="flex flex-wrap items-end gap-3 rounded-[var(--radius-panel)] border border-dashed border-border p-4"
      >
        {state.error && (
          <Alert tone="danger" className="w-full">
            {state.error}
          </Alert>
        )}
        <div className="w-36">
          <FormField label="Level">
            <NativeSelect
              name="level"
              options={enumOptions(REGION_LEVELS)}
              defaultValue="COUNTRY"
            />
          </FormField>
        </div>
        <div className="min-w-40 flex-1">
          <FormField label="Name" required>
            <Input name="name" required maxLength={160} />
          </FormField>
        </div>
        <div className="w-24">
          <FormField label="Code">
            <Input name="code" maxLength={20} placeholder="US" />
          </FormField>
        </div>
        <div className="w-44">
          <FormField label="Parent">
            <NativeSelect
              name="parentId"
              options={regions.map((r) => ({ value: r.id, label: r.name }))}
              placeholder="— none (top level) —"
            />
          </FormField>
        </div>
        <Button type="submit" size="sm" disabled={creating}>
          <Plus aria-hidden="true" className="size-4" /> Add
        </Button>
      </form>

      {regions.length === 0 ? (
        <p className="text-sm text-muted">No regions yet — add the first one above.</p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface/50 text-left">
                <th className="px-4 py-2.5 font-medium text-muted">Name</th>
                <th className="px-4 py-2.5 font-medium text-muted">Level</th>
                <th className="px-4 py-2.5 font-medium text-muted">Code</th>
                <th className="px-4 py-2.5 font-medium text-muted">Parent</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted">Actions</th>
              </tr>
            </thead>
            <tbody>
              {regions.map((region) =>
                editingId === region.id ? (
                  <RegionEditRow
                    key={region.id}
                    region={region}
                    regions={regions}
                    onDone={() => setEditingId(null)}
                  />
                ) : (
                  <tr
                    key={region.id}
                    className="border-b border-border last:border-0 hover:bg-surface/40"
                  >
                    <td className="px-4 py-2.5 font-medium text-foreground">{region.name}</td>
                    <td className="px-4 py-2.5 text-muted">{enumLabel(region.level)}</td>
                    <td className="px-4 py-2.5 text-muted">{region.code ?? '—'}</td>
                    <td className="px-4 py-2.5 text-muted">
                      {region.parentId ? (nameById.get(region.parentId) ?? '—') : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Edit ${region.name}`}
                          onClick={() => setEditingId(region.id)}
                        >
                          <Pencil aria-hidden="true" className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${region.name}`}
                          onClick={async () => {
                            if (
                              !(await confirm({
                                title: `Delete ${region.name}?`,
                                message:
                                  'This is permanent. A region with child regions or edition tags can’t be deleted.',
                                confirmLabel: 'Delete',
                                tone: 'danger',
                              }))
                            )
                              return;
                            try {
                              await deleteRegion(region.id);
                              toast({ title: 'Region deleted', tone: 'success' });
                            } catch (e) {
                              toast({
                                title: e instanceof Error ? e.message : 'Delete failed',
                                tone: 'error',
                              });
                            }
                          }}
                        >
                          <Trash aria-hidden="true" className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** One region row in edit mode — an inline form; Save writes through updateRegion. */
function RegionEditRow({
  region,
  regions,
  onDone,
}: {
  region: Region;
  regions: Region[];
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const parentOptions = regions
    .filter((r) => r.id !== region.id)
    .map((r) => ({ value: r.id, label: r.name }));

  return (
    <tr className="border-b border-border bg-surface/30 last:border-0">
      <td colSpan={5} className="px-4 py-3">
        <form
          action={(form) =>
            startTransition(async () => {
              const result = await updateRegion(region.id, INITIAL, form);
              if (result.ok) {
                toast({ title: 'Region saved', tone: 'success' });
                onDone();
              } else {
                toast({ title: result.error ?? 'Save failed', tone: 'error' });
              }
            })
          }
          className="flex flex-wrap items-end gap-3"
        >
          <div className="w-36">
            <FormField label="Level">
              <NativeSelect
                name="level"
                options={enumOptions(REGION_LEVELS)}
                defaultValue={region.level}
              />
            </FormField>
          </div>
          <div className="min-w-40 flex-1">
            <FormField label="Name" required>
              <Input name="name" defaultValue={region.name} required maxLength={160} />
            </FormField>
          </div>
          <div className="w-24">
            <FormField label="Code">
              <Input name="code" defaultValue={region.code ?? ''} maxLength={20} />
            </FormField>
          </div>
          <div className="w-44">
            <FormField label="Parent">
              <NativeSelect
                name="parentId"
                options={parentOptions}
                placeholder="— none (top level) —"
                defaultValue={region.parentId ?? ''}
              />
            </FormField>
          </div>
          <Button type="submit" size="sm" disabled={pending}>
            <Check aria-hidden="true" className="size-4" /> Save
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onDone}>
            <X aria-hidden="true" className="size-4" /> Cancel
          </Button>
        </form>
      </td>
    </tr>
  );
}
