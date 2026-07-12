'use client';

import { useRef, useTransition } from 'react';
import { Button, FormField, Input, Plus, Textarea, Trash, useToast } from '@beecompete/ui';
import { addFaq, deleteFaq } from '@/app/admin/competitions/[id]/child-actions';
import type { Faq } from '@/lib/admin-types';

export function FaqManager({ competitionId, faqs }: { competitionId: string; faqs: Faq[] }) {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  return (
    <div className="grid gap-4">
      {faqs.length === 0 && <p className="text-sm text-muted">No FAQ entries yet.</p>}
      <ul className="grid gap-2">
        {faqs.map((f) => (
          <li
            key={f.id}
            className="flex items-start justify-between gap-3 rounded-[var(--radius-panel)] border border-border p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{f.question}</p>
              <p className="mt-0.5 text-sm text-muted">{f.answer}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Delete FAQ"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    await deleteFaq(competitionId, f.id);
                    toast({ title: 'FAQ deleted', tone: 'success' });
                  } catch (e) {
                    toast({
                      title: e instanceof Error ? e.message : 'Delete failed',
                      tone: 'error',
                    });
                  }
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
              await addFaq(competitionId, form);
              formRef.current?.reset();
              toast({ title: 'FAQ added', tone: 'success' });
            } catch (e) {
              toast({ title: e instanceof Error ? e.message : 'Add failed', tone: 'error' });
            }
          })
        }
        className="grid gap-3 rounded-[var(--radius-panel)] border border-dashed border-border p-4"
      >
        <FormField label="Question" required>
          <Input name="question" required maxLength={500} />
        </FormField>
        <FormField label="Answer" required>
          <Textarea name="answer" required rows={2} />
        </FormField>
        <div className="flex items-center gap-3">
          <div className="w-24">
            <FormField label="Order">
              <Input name="displayOrder" type="number" defaultValue={faqs.length} />
            </FormField>
          </div>
          <Button type="submit" size="sm" disabled={pending} className="mt-6">
            <Plus aria-hidden="true" className="size-4" /> Add
          </Button>
        </div>
      </form>
    </div>
  );
}
