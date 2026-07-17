'use client';

import { useRef, useState, useTransition } from 'react';
import {
  Button,
  Checkbox,
  FormField,
  Input,
  Plus,
  Select,
  Trash,
  useConfirm,
  useToast,
} from '@beecompete/ui';
import { enumLabel, enumOptions } from '@/components/admin/enum-labels';
import { addKeyDate, deleteKeyDate } from '@/app/admin/competitions/[id]/editions/actions';
import { formatInZone } from '@/lib/dates';
import { ADMIN_TIMEZONES, KEY_DATE_TYPES, type KeyDate } from '@/lib/admin-types';

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
  const [tbd, setTbd] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { confirm, dialog } = useConfirm();
  const { toast } = useToast();

  return (
    <div className="grid gap-4">
      {dialog}
      <ul className="grid gap-2">
        {keyDates.map((k) => (
          <li
            key={k.id}
            className="flex items-center justify-between gap-3 rounded-[var(--radius-panel)] border border-border p-3 text-sm"
          >
            <span className="min-w-0">
              <span className="font-medium text-foreground">{enumLabel(k.type)}</span>
              {k.label && <span className="ml-2 text-foreground">— {k.label}</span>}
              <span className="ml-2 text-muted">
                {k.startsAt ? formatInZone(k.startsAt, k.timezone) : 'Date TBD'}
              </span>
              {k.endsAt && (
                <span className="ml-1 text-muted">→ {formatInZone(k.endsAt, k.timezone)}</span>
              )}
            </span>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Delete key date"
              disabled={pending}
              onClick={async () => {
                if (
                  !(await confirm({
                    title: 'Delete this key date?',
                    message: 'This is permanent — there is no restore.',
                    confirmLabel: 'Delete',
                    tone: 'danger',
                  }))
                )
                  return;
                startTransition(async () => {
                  try {
                    await deleteKeyDate(competitionId, editionId, k.id);
                    toast({ title: 'Key date deleted', tone: 'success' });
                  } catch (e) {
                    toast({
                      title: e instanceof Error ? e.message : 'Delete failed',
                      tone: 'error',
                    });
                  }
                });
              }}
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
              setTbd(false);
              toast({ title: 'Key date added', tone: 'success' });
            } catch (err) {
              toast({ title: err instanceof Error ? err.message : 'Add failed', tone: 'error' });
            }
          })
        }
        className="grid gap-3 rounded-[var(--radius-panel)] border border-dashed border-border p-4 sm:grid-cols-3"
      >
        <FormField label="Type">
          <Select name="type" options={enumOptions(KEY_DATE_TYPES)} defaultValue="REG_CLOSE" />
        </FormField>
        <FormField label="Starts">
          <Input name="startsAt" type="datetime-local" required={!tbd} disabled={tbd} />
        </FormField>
        <FormField label="Timezone">
          <Select name="timezone" options={ADMIN_TIMEZONES} defaultValue="America/New_York" />
        </FormField>
        <FormField label="Ends" hint="optional — for windows">
          <Input name="endsAt" type="datetime-local" disabled={tbd} />
        </FormField>
        <FormField label="Label" hint="optional — shown for Custom dates">
          <Input name="label" maxLength={200} />
        </FormField>
        {/* TBD (R1-18): the milestone exists but its date is unknown — submit without a date.
            mt-[26px] + h-10 centers the checkbox on the neighbors' control band (label 20px +
            gap 6px above a 40px control). */}
        <div className="mt-[26px] flex h-10 items-center">
          <Checkbox
            label="Date TBD (to be determined)"
            checked={tbd}
            onChange={(e) => setTbd(e.target.checked)}
          />
        </div>
        <div className="sm:col-span-3">
          <Button type="submit" size="sm" disabled={pending}>
            <Plus aria-hidden="true" className="size-4" /> Add key date
          </Button>
        </div>
      </form>
    </div>
  );
}
