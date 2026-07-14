'use client';

import { useRef, useTransition } from 'react';
import {
  Button,
  Checkbox,
  ExternalLink,
  FormField,
  Input,
  Plus,
  Trash,
  useConfirm,
  useToast,
} from '@beecompete/ui';
import { Select } from '@beecompete/ui';
import { enumOptions } from '@/components/admin/enum-labels';
import { addResource, deleteResource } from '@/app/admin/competitions/[id]/child-actions';
import { RESOURCE_TYPES, type Resource } from '@/lib/admin-types';

export function ResourceManager({
  competitionId,
  resources,
}: {
  competitionId: string;
  resources: Resource[];
}) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const { confirm, dialog } = useConfirm();
  const { toast } = useToast();

  return (
    <div className="grid gap-4">
      {dialog}
      {resources.length === 0 && <p className="text-sm text-muted">No resources yet.</p>}
      <ul className="grid gap-2">
        {resources.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between gap-3 rounded-[var(--radius-panel)] border border-border p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {r.title}
                {r.isAffiliate && <span className="ml-2 text-xs text-brand-gold">affiliate</span>}
              </p>
              <a
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
              >
                {r.url} <ExternalLink aria-hidden="true" className="size-3" />
              </a>
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Delete resource"
              disabled={pending}
              onClick={async () => {
                if (
                  !(await confirm({
                    title: 'Delete this resource?',
                    message: 'This is permanent — there is no restore.',
                    confirmLabel: 'Delete',
                    tone: 'danger',
                  }))
                )
                  return;
                startTransition(async () => {
                  try {
                    await deleteResource(competitionId, r.id);
                    toast({ title: 'Resource deleted', tone: 'success' });
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
              await addResource(competitionId, form);
              formRef.current?.reset();
              toast({ title: 'Resource added', tone: 'success' });
            } catch (e) {
              toast({ title: e instanceof Error ? e.message : 'Add failed', tone: 'error' });
            }
          })
        }
        className="grid gap-3 rounded-[var(--radius-panel)] border border-dashed border-border p-4 sm:grid-cols-2"
      >
        <FormField label="Title" required>
          <Input name="title" required maxLength={300} />
        </FormField>
        <FormField label="URL" required>
          <Input name="url" type="url" required />
        </FormField>
        <FormField label="Type">
          <Select name="type" options={enumOptions(RESOURCE_TYPES)} defaultValue="GUIDE" />
        </FormField>
        <FormField label="Order" hint="lower shows first">
          <Input name="displayOrder" type="number" min={0} defaultValue={resources.length} />
        </FormField>
        <div className="flex items-center">
          <Checkbox name="isAffiliate" label="Affiliate link" />
        </div>
        <div className="flex items-center">
          <Button type="submit" size="sm" disabled={pending}>
            <Plus aria-hidden="true" className="size-4" /> Add resource
          </Button>
        </div>
      </form>
    </div>
  );
}
