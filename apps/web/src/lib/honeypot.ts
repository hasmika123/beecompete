import { HONEYPOT_FIELD } from '@beecompete/ui';

/**
 * True when the honeypot field was filled — a bot. Server-side counterpart to the <Honeypot/>
 * component (packages/ui): pairs on the shared HONEYPOT_FIELD name so the two can't drift. Callers
 * should silently "succeed" (store nothing) when this returns true, to avoid tipping off the bot.
 */
export function isHoneypotTripped(form: FormData): boolean {
  return Boolean(String(form.get(HONEYPOT_FIELD) ?? '').trim());
}
