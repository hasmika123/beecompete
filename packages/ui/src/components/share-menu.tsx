'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ComponentType } from 'react';
import { Check, Copy, Facebook, Linkedin, Mail, Share, Whatsapp, XLogo } from '../icons';
import { cn } from '../lib/cn';

/**
 * ShareMenu (R1-11, M21) — a competition's share surface: a trigger button that opens a popover
 * of explicit channels plus copy-link, and the OS share sheet where available. Supersedes the
 * R1-7 light share button. Used on the detail header (`variant="button"`) and on the
 * CompetitionCard corner (`variant="icon"`, A8).
 *
 * PRIVACY (M21/M34 rule — "plain link action, collects nothing"): every channel is a plain
 * intent URL opened in a new tab; the shared URL is the clean page URL with NO tracking/UTM
 * params; nothing is logged and no login is required.
 *
 * The popover renders through a PORTAL to <body> with fixed positioning computed from the
 * trigger — so it never clips inside an `overflow-hidden` card and never hides behind a
 * sibling card's stacking context (both real when the trigger sits on a card).
 *
 * A11y: the popover is a labeled group of ordinary focusable controls (not an ARIA menu — no
 * arrow-key contract to honor); Escape and click-outside close it and return focus to the
 * trigger; the first item is focused on open. Scroll/resize close it (fixed position is
 * computed once at open time).
 */

type IconType = ComponentType<{
  className?: string;
  weight?: 'regular' | 'bold' | 'fill' | 'duotone';
}>;

interface Channel {
  key: string;
  label: string;
  icon: IconType;
  build: (url: string, title: string) => string;
}

const enc = encodeURIComponent;

// Order (after Copy link): Email, X, Facebook, WhatsApp, LinkedIn — matches the R1-11 spec.
const CHANNELS: Channel[] = [
  {
    key: 'email',
    label: 'Email',
    icon: Mail,
    build: (u, t) => `mailto:?subject=${enc(t)}&body=${enc(`${t}\n\n${u}`)}`,
  },
  {
    key: 'x',
    label: 'X',
    icon: XLogo,
    build: (u, t) => `https://twitter.com/intent/tweet?url=${enc(u)}&text=${enc(t)}`,
  },
  {
    key: 'facebook',
    label: 'Facebook',
    icon: Facebook,
    build: (u) => `https://www.facebook.com/sharer/sharer.php?u=${enc(u)}`,
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp',
    icon: Whatsapp,
    build: (u, t) => `https://wa.me/?text=${enc(`${t} ${u}`)}`,
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    icon: Linkedin,
    build: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${enc(u)}`,
  },
];

const itemClass =
  'flex w-full items-center gap-2.5 rounded-[var(--radius-field)] px-3 py-2 text-left text-sm text-foreground hover:bg-surface focus-visible:bg-surface focus-visible:outline-none';

const MENU_WIDTH = 192; // w-48

export interface ShareMenuProps {
  title: string;
  /** Site-relative path; resolved to an absolute URL against the current origin at open time. */
  path: string;
  /** `button` = labeled pill (detail header). `icon` = compact circle (card corner). */
  variant?: 'button' | 'icon';
  className?: string;
}

export function ShareMenu({ title, path, variant = 'button', className }: ShareMenuProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);

  const hasNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (!open) return;
    firstItemRef.current?.focus();
    const onDocPointer = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!triggerRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    // Fixed position is computed once at open; a scroll/resize would strand it, so close.
    const onScrollResize = () => setOpen(false);
    document.addEventListener('mousedown', onDocPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScrollResize, true);
    window.addEventListener('resize', onScrollResize);
    return () => {
      document.removeEventListener('mousedown', onDocPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScrollResize, true);
      window.removeEventListener('resize', onScrollResize);
    };
  }, [open]);

  const toggle = () => {
    if (open) {
      setOpen(false);
      return;
    }
    setShareUrl(`${window.location.origin}${path}`);
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setPos({
        top: rect.bottom + 8,
        left: Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
      });
    }
    setOpen(true);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — the channel links still work
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title, url: shareUrl });
      setOpen(false);
    } catch {
      // user cancelled — keep the menu open
    }
  };

  const trigger =
    variant === 'icon' ? (
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Share ${title}`}
        onClick={toggle}
        className={cn(
          'inline-flex size-8 items-center justify-center rounded-full text-foreground shadow-sm transition-colors',
          // Backdrop keeps the icon legible over any cover art (§4 text-over-imagery rule).
          'border border-border bg-surface-raised/90 backdrop-blur hover:bg-surface',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        )}
      >
        <Share aria-hidden="true" className="size-4" />
      </button>
    ) : (
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={toggle}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-border/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <Share aria-hidden="true" className="size-4" />
        Share
      </button>
    );

  return (
    <div className={cn('inline-block', className)}>
      {trigger}
      {open &&
        pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={menuRef}
            role="group"
            aria-label={`Share ${title}`}
            style={{ position: 'fixed', top: pos.top, left: pos.left, width: MENU_WIDTH }}
            className="z-50 rounded-[var(--radius-panel)] border border-border bg-surface-raised p-1 shadow-[var(--shadow-popover)]"
          >
            <button ref={firstItemRef} type="button" onClick={copyLink} className={itemClass}>
              {copied ? (
                <>
                  <Check aria-hidden="true" className="size-4 text-success" />
                  Copied
                </>
              ) : (
                <>
                  <Copy aria-hidden="true" className="size-4 text-muted" />
                  Copy link
                </>
              )}
            </button>

            {hasNative && (
              <button type="button" onClick={nativeShare} className={itemClass}>
                <Share aria-hidden="true" className="size-4 text-muted" />
                Share…
              </button>
            )}

            {CHANNELS.map((c) => {
              const Icon = c.icon;
              return (
                <a
                  key={c.key}
                  href={c.build(shareUrl, title)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className={itemClass}
                >
                  <Icon aria-hidden="true" className="size-4 text-muted" />
                  {c.label}
                </a>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
