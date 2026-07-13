'use client';

import { useActionState, useEffect, useRef } from 'react';
import { Alert, Button, FormField, Input, Plus, useToast } from '@beecompete/ui';
import { NativeSelect } from '@/components/admin/native-select';
import { createCategory } from '@/app/admin/categories/actions';
import type { Category, FormState } from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

// createCategory redirects to the new category's edit page on success, so this form only shows
// the error path; the redirect handles the happy path.
export function CategoryCreateForm({ allCategories }: { allCategories: Category[] }) {
  const [state, formAction, pending] = useActionState(createCategory, INITIAL);
  const ref = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (state.error) toast({ title: state.error, tone: 'error' });
  }, [state.error, toast]);

  return (
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
      <div className="min-w-40 flex-1">
        <FormField label="Name" required>
          <Input name="name" required maxLength={120} />
        </FormField>
      </div>
      <div className="min-w-40 flex-1">
        <FormField label="Slug" required>
          <Input name="slug" required maxLength={140} pattern="[a-z0-9]+(-[a-z0-9]+)*" />
        </FormField>
      </div>
      <div className="min-w-40 flex-1">
        <FormField label="Parent" hint="optional — for subcategories">
          <NativeSelect
            name="parentId"
            options={allCategories.map((c) => ({ value: c.id, label: c.name }))}
            placeholder="— none (top level) —"
          />
        </FormField>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        <Plus aria-hidden="true" className="size-4" /> Add category
      </Button>
    </form>
  );
}
