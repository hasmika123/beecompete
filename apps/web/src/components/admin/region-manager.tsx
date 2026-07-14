'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Alert, Button, FormField, Input, Plus, useToast } from '@beecompete/ui';
import { NativeSelect, enumLabel, enumOptions } from '@/components/admin/native-select';
import { createRegion } from '@/app/admin/categories/actions';
import { REGION_LEVELS, type FormState, type Region } from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

export function RegionManager({ regions }: { regions: Region[] }) {
  const [state, formAction, pending] = useActionState(createRegion, INITIAL);
  const ref = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (state.ok) {
      toast({ title: 'Region added', tone: 'success' });
      ref.current?.reset();
    }
  }, [state.ok, toast]);

  return (
    <div className="grid gap-4">
      {regions.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {regions.map((r) => (
            <li
              key={r.id}
              className="rounded-full border border-border px-3 py-1 text-sm text-foreground"
            >
              {r.name} <span className="text-muted">· {enumLabel(r.level)}</span>
            </li>
          ))}
        </ul>
      )}
      <form
        ref={ref}
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
          {/* Hint dropped (would float the control up in this items-end row); the placeholder
              conveys "top level", and nesting is obvious from the region list above. */}
          <FormField label="Parent">
            <NativeSelect
              name="parentId"
              options={regions.map((r) => ({ value: r.id, label: r.name }))}
              placeholder="— none (top level) —"
            />
          </FormField>
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          <Plus aria-hidden="true" className="size-4" /> Add
        </Button>
      </form>
    </div>
  );
}
