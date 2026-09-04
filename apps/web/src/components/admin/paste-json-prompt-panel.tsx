'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Check, Copy } from '@beecompete/ui';
import {
  PASTE_JSON_PROMPT,
  PASTE_JSON_PROMPT_SOURCE,
  PASTE_JSON_PROMPT_STEPS,
} from '@/lib/paste-json-prompt.generated';

/**
 * The prompt that PRODUCES the JSON, on the screen where the JSON is pasted (owner 2026-09-03).
 *
 * It lived only in `docs/seeding/paste-json-prompt.md`, so using it meant leaving the admin, going
 * to the repo, and trusting that the copy you had saved somewhere was still the current one. The
 * text here is generated from that same file at build time (see
 * `scripts/generate-paste-json-prompt.mjs`), which is the whole point: the doc stays the one place
 * the prompt is edited, and the button here always hands out the version that shipped.
 *
 * The ~30 KB of prompt text rides in the admin route's bundle. That is a deliberate trade against
 * a fetch: this is one authenticated internal page, and a copy button that can fail on a slow
 * network is worse than a page that weighs a little more.
 */
export function PasteJsonPromptPanel() {
  const [copied, setCopied] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [open, setOpen] = useState(false);
  const revert = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (revert.current) clearTimeout(revert.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(PASTE_JSON_PROMPT);
      setCopied(true);
      setBlocked(false);
      if (revert.current) clearTimeout(revert.current);
      revert.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard refused (permission, or a non-secure origin). Open the prompt instead of
      // failing quietly — selecting it by hand still gets the curator moving.
      setCopied(false);
      setBlocked(true);
      setOpen(true);
    }
  };

  return (
    <div className="grid gap-2 rounded-[var(--radius-field)] border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Don’t have the JSON yet?</p>
        <Button variant="secondary" size="sm" onClick={copy}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy prompt'}
        </Button>
      </div>
      <p className="text-xs text-muted">
        Paste the prompt into any assistant along with the competition’s URL, page text, or your
        notes — then paste the JSON it returns into the box below.
      </p>
      {/* Announced rather than only shown: the button's own label change is not reliably read. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? 'Prompt copied to the clipboard' : ''}
      </span>
      {blocked && (
        <p className="text-xs text-danger">
          The browser blocked the clipboard — the prompt is open below; select it and copy by hand.
        </p>
      )}
      <details
        open={open}
        onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
        className="rounded-[var(--radius-field)] border border-border bg-background"
      >
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted hover:text-foreground">
          Read the prompt and the steps around it
        </summary>
        <div className="grid gap-2 border-t border-border p-3">
          {/* ONE bounded scroller for the whole reference block. Eight steps and 700 lines of
              prompt expanded inline pushed the dialog past the bottom of a laptop screen — and
              took its Cancel / Fill form footer with it, on a surface that locks page scroll. */}
          <div className="max-h-72 overflow-auto rounded-md border border-border bg-surface p-2">
            <ol className="list-decimal space-y-1 pl-5 text-xs text-muted">
              {PASTE_JSON_PROMPT_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <pre className="mt-3 border-t border-border pt-3 font-mono text-[11px] whitespace-pre-wrap text-foreground">
              {PASTE_JSON_PROMPT}
            </pre>
          </div>
          <p className="text-[11px] text-muted">
            Maintained in <code className="font-mono">{PASTE_JSON_PROMPT_SOURCE}</code> — this copy
            is generated from it on every build, so editing the prompt there updates the button
            here.
          </p>
        </div>
      </details>
    </div>
  );
}
