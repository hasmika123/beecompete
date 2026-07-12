'use client';

import { useState } from 'react';
import { Check, Share } from '@beecompete/ui';

// Share a competition (→ M21, R1-11 proper). R1-7 ships the light version living on the
// detail header: native share sheet where available, clipboard copy otherwise, with a short
// "Copied" confirmation. The full share surface (channel buttons) is R1-11.

interface ShareButtonProps {
  title: string;
  /** Site-relative path; resolved against the current origin at click time. */
  path: string;
}

export function ShareButton({ title, path }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const onShare = async () => {
    const url = `${window.location.origin}${path}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // user cancelled or share failed — fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — nothing else to do at R1
    }
  };

  return (
    <button
      type="button"
      onClick={onShare}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-border/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      aria-label={`Share ${title}`}
    >
      {copied ? (
        <>
          <Check aria-hidden="true" className="size-4 text-success" />
          Copied
        </>
      ) : (
        <>
          <Share aria-hidden="true" className="size-4" />
          Share
        </>
      )}
    </button>
  );
}
