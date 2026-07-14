'use client';

import { useActionState, useEffect } from 'react';
import { Alert, Button, FormField, Input, Select, useToast } from '@beecompete/ui';
import { updateCategory } from '@/app/admin/categories/actions';
import type { Category, FormState } from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

export function CategoryEditForm({
  category,
  allCategories,
}: {
  category: Category;
  allCategories: Category[];
}) {
  const [state, formAction, pending] = useActionState(
    updateCategory.bind(null, category.id),
    INITIAL,
  );
  const { toast } = useToast();

  useEffect(() => {
    if (state.ok) toast({ title: 'Saved', tone: 'success' });
  }, [state.ok, toast]);

  const parentOptions = allCategories
    .filter((c) => c.id !== category.id)
    .map((c) => ({ value: c.id, label: c.name }));

  return (
    <form action={formAction} className="grid max-w-xl gap-5">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <FormField label="Name" required>
        <Input name="name" defaultValue={category.name} required maxLength={120} />
      </FormField>
      <FormField label="Slug" required>
        <Input name="slug" defaultValue={category.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" />
      </FormField>
      <FormField label="Parent" hint="optional — for subcategories">
        <Select
          name="parentId"
          options={[{ value: '', label: '— none (top level) —' }, ...parentOptions]}
          placeholder="— none (top level) —"
          defaultValue={category.parentId ?? ''}
          searchable
        />
      </FormField>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
