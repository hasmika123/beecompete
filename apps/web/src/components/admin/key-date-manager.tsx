'use client';

import { useRef, useTransition } from 'react';
import { Button, FormField, Input, Plus, Trash, useToast } from '@beecompete/ui';
import { NativeSelect, enumOptions } from '@/components/admin/native-select';
import { addKeyDate, deleteKeyDate } from '@/app/admin/competitions/[id]/editions/actions';
import { KEY_DATE_TYPES, type KeyDate } from '@/lib/admin-types';

export function KeyDateManager({
  competitionId,
  editionId,
  keyDates,
}: {
  competitionId: string;
  editionId: string;
  keyDates: KeyDate[];
}) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  return (
    <div className="grid gap-4">
      <ul className="grid gap-2">
        {keyDates.map((k) => (
          <li
            key={k.id}
            className="flex items-center justify-between gap-3 rounded-[var(--radius-panel)] border border-border p-3 text-sm"
          >
            <span>
              <span className="font-medium text-foreground">
                {k.type.toLowerCase().replace(/_/g, ' ')}
              </span>
              <span className="ml-2 text-muted">{new Date(k.startsAt).toLocaleString()}</span>
              {k.timezone && <span className="ml-2 text-xs text-muted">({k.timezone})</span>}
            </span>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Delete key date"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await deleteKeyDate(competitionId, editionId, k.id);
                  toast({ title: 'Key date deleted', tone: 'success' });
                })
              }
            >
              <Trash aria-hidden="true" className="size-4" />
            </Button>
          </li>
        ))}
      </ul>

      <form
        ref={formRef}
        action={(form) =>
          startTransition(async () => {
            try {
              await addKeyDate(competitionId, editionId, form);
              formRef.current?.reset();
              toast({ title: 'Key date added', tone: 'success' });
            } catch (err) {
              toast({ title: err instanceof Error ? err.message : 'Add failed', tone: 'error' });
            }
          })
        }
        className="grid gap-3 rounded-[var(--radius-panel)] border border-dashed border-border p-4 sm:grid-cols-3"
      >
        <FormField label="Type">
          <NativeSelect
            name="type"
            options={enumOptions(KEY_DATE_TYPES)}
            defaultValue="REG_CLOSE"
          />
        </FormField>
        <FormField label="When">
          <Input name="startsAt" type="datetime-local" required />
        </FormField>
        <FormField label="Timezone" hint="IANA, e.g. America/New_York">
          <Input name="timezone" placeholder="America/New_York" />
        </FormField>
        <div className="sm:col-span-3">
          <Button type="submit" size="sm" disabled={pending}>
            <Plus aria-hidden="true" className="size-4" /> Add key date
          </Button>
        </div>
      </form>
    </div>
  );
}
