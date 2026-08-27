import 'server-only';
import { headers } from 'next/headers';

// WHO is using /admin. Curators sign in individually through Cloudflare Access (each address is
// its own allow-list entry, revocable on its own); Access then stamps the authenticated address
// on every request it forwards to the origin. This reads that stamp so admin writes can be
// attributed — see CuratorAuditFilter on the API for what happens with it.
//
// ⚠ Advisory, never authorization. The gate is Access plus the server-side ADMIN_API_TOKEN; this
// value only labels a request that already passed both. It is not verified here, so a caller that
// reached the origin directly — bypassing Cloudflare — could set any address. That pollutes an
// audit label; it cannot grant entry. Real identity arrives with RBAC at R2-7.

/** Set by Cloudflare Access on every request it forwards once the user has authenticated. */
const ACCESS_EMAIL_HEADER = 'cf-access-authenticated-user-email';

/**
 * The signed-in curator's email, or null when unattributed.
 *
 * Null is normal, not an error: local dev has no Access in front of it, and scripts talk to the
 * API directly. Set `DEV_CURATOR_EMAIL` locally to exercise the attribution path.
 */
export async function curatorEmail(): Promise<string | null> {
  try {
    const value = (await headers()).get(ACCESS_EMAIL_HEADER);
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  } catch {
    // headers() throws outside a request scope (build-time evaluation). Unattributed is the
    // correct answer there, and must never take an admin page down.
  }
  return process.env.DEV_CURATOR_EMAIL?.trim() || null;
}
