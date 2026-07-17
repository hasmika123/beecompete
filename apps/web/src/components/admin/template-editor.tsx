'use client';

import { useActionState, useEffect } from 'react';
import { Alert, Button, FormField, Textarea, useToast } from '@beecompete/ui';
import { putCategoryTemplate } from '@/app/admin/categories/actions';
import type { CategoryTemplate, FormState } from '@/lib/admin-types';

const INITIAL: FormState = { ok: false };

export function TemplateEditor({
  categoryId,
  template,
}: {
  categoryId: string;
  template: CategoryTemplate | null;
}) {
  const [state, formAction, pending] = useActionState(
    putCategoryTemplate.bind(null, categoryId),
    INITIAL,
  );
  const { toast } = useToast();

  useEffect(() => {
    if (state.ok) toast({ title: 'Template saved', tone: 'success' });
  }, [state.ok, toast]);

  const schemaText = template ? JSON.stringify(template.jsonSchema, null, 2) : '';
  const hintsText = template?.uiHints ? JSON.stringify(template.uiHints, null, 2) : '';

  return (
    <form action={formAction} className="grid gap-4">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <FormField
        label="JSON Schema"
        hint="Validates every Competition's attributes bag in this category (draft 2020-12)."
      >
        <Textarea
          name="jsonSchema"
          defaultValue={schemaText}
          rows={16}
          required
          className="font-mono text-xs"
          placeholder='{ "type": "object", "additionalProperties": true, "properties": {} }'
        />
      </FormField>
      <FormField
        label="UI hints (JSON, optional)"
        hint='Drives the competition form’s attributes fields. Shape: { "order": [keys…], "labels": { key: text }, "placeholders": { key: text }, "widgets": { key: "textarea" } }.'
      >
        <Textarea
          name="uiHints"
          defaultValue={hintsText}
          rows={5}
          className="font-mono text-xs"
          placeholder='{ "order": ["topics"], "labels": { "topics": "Covered topics" }, "placeholders": { "topics": "algebra, geometry" }, "widgets": { "syllabus": "textarea" } }'
        />
      </FormField>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save template'}
        </Button>
      </div>
    </form>
  );
}
