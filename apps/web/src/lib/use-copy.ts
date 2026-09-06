'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Copy-to-clipboard with the two states a copy button actually has: it worked (say so briefly), or
 * the browser refused (permission, or a non-secure origin — then the caller shows the text so it
 * can be selected by hand). Shared by the paste-JSON panel and the per-step prompt buttons so
 * "Copied" behaves the same wherever it appears.
 */
export function useCopyToClipboard(resetMs = 2500) {
  const [copied, setCopied] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const revert = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (revert.current) clearTimeout(revert.current);
    },
    [],
  );

  const copy = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setBlocked(false);
      if (revert.current) clearTimeout(revert.current);
      revert.current = setTimeout(() => setCopied(false), resetMs);
      return true;
    } catch {
      setCopied(false);
      setBlocked(true);
      return false;
    }
  };

  return { copied, blocked, copy };
}
