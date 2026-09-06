'use client';

import { useState } from 'react';
import { Alert, Button, Check, Copy, Modal, Sparkles } from '@beecompete/ui';
import { buildImportApprovalPayload } from '@/lib/competition-payload';
import {
  buildStepPrompt,
  stepSlice,
  STEP_PROMPT_SOURCE,
  type StepPromptContext,
} from '@/lib/step-prompt';
import { useCopyToClipboard } from '@/lib/use-copy';

/**
 * "Ask an assistant" on a step of the create form — a prompt for THESE fields, built from the
 * listing as it currently stands (owner 2026-09-03). See lib/step-prompt.ts for why the reply is
 * the whole payload rather than a fragment.
 *
 * The prompt is built when the modal OPENS, never on render: it reads the live form via the
 * button's own `form` property, so it always describes what is on screen right now — including
 * fields the curator changed a second ago.
 */
export function StepPromptButton({
  stepId,
  context,
}: {
  stepId: string;
  context: StepPromptContext;
}) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { copied, blocked, copy } = useCopyToClipboard();

  const slice = stepSlice(stepId);
  if (!slice) return null;

  /** `form` comes from the button itself — it sits inside the create form, so no ref is needed. */
  const build = (form: HTMLFormElement | null) => {
    // buildImportApprovalPayload throws on a malformed attributes/extras bag — the same JSON the
    // save would refuse. Saying so beats handing over a prompt built from a payload we couldn't read.
    try {
      const payload = form ? buildImportApprovalPayload(new FormData(form)) : {};
      setPrompt(buildStepPrompt({ slice, context, payload }));
      setError(null);
    } catch (e) {
      setPrompt('');
      setError(e instanceof Error ? e.message : 'Could not read the form.');
    }
    setOpen(true);
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => build(e.currentTarget.form)}
        aria-label={`Ask an assistant for the ${slice.label} step`}
      >
        <Sparkles aria-hidden="true" /> Ask an assistant
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        // Wider than the default dialog, and scrollable: the preview is column-aligned prompt
        // text (the JSON shape's comments line up), so it is read at its own width or not at all —
        // and it can outgrow a short screen while page scroll is locked.
        className="max-h-[85vh] max-w-2xl overflow-y-auto"
        title={`Ask for the ${slice.label} step`}
        description="Paste this into ChatGPT, Claude, or any assistant. It asks only for this step's fields and replies with the whole listing, so the answer goes straight into Paste JSON."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
            <Button variant="primary" onClick={() => copy(prompt)} disabled={prompt === ''}>
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy prompt'}
            </Button>
          </div>
        }
      >
        <div className="grid gap-2">
          {error ? (
            <Alert tone="danger" title="Can't build the prompt">
              {error}
            </Alert>
          ) : (
            <>
              <span role="status" aria-live="polite" className="sr-only">
                {copied ? 'Prompt copied to the clipboard' : ''}
              </span>
              {blocked && (
                <p className="text-xs text-danger">
                  The browser blocked the clipboard — select the prompt below and copy it by hand.
                </p>
              )}
              {slice.tail && (
                <p className="text-xs text-muted">
                  This step also asks for an answer in plain text: the award rows have no field in
                  the pasted JSON, so you type those in yourself.
                </p>
              )}
              {/* whitespace-pre, not -wrap: the shape lines carry their rules in a comment column
                  that wrapping shreds. It scrolls in its own box instead. */}
              <pre className="max-h-72 overflow-auto rounded-md border border-border bg-surface p-2 font-mono text-[11px] text-foreground">
                {prompt}
              </pre>
              <p className="text-[11px] text-muted">
                The rules come from <code className="font-mono">{STEP_PROMPT_SOURCE}</code>; the
                listing below them is what is in this form right now.
              </p>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
