// The distinct email subscription flows (R1-15c). One source of truth shared by the captures
// (which tell Brevo where to send the subscriber after they confirm) and the /subscribed/[flow]
// confirmation page (which renders the matching "you're in" copy).
//
// These slugs are PUBLIC URL segments and they're baked into confirmation links that live in
// already-sent emails — renaming one breaks every unclicked link in every inbox. Add, don't rename.
//
// Note "claim" is deliberately absent: claiming a listing is a form → admin inbox, not a list
// subscription, so it has no double-opt-in step and no confirmation landing (see claim-actions.ts).

export const SUBSCRIPTION_FLOWS = ['digest', 'follow', 'hosts'] as const;

export type SubscriptionFlow = (typeof SUBSCRIPTION_FLOWS)[number];

export function isSubscriptionFlow(value: string): value is SubscriptionFlow {
  return (SUBSCRIPTION_FLOWS as readonly string[]).includes(value);
}

/** Site-relative path a subscriber lands on after clicking confirm in their email. */
export function confirmationPath(flow: SubscriptionFlow): string {
  return `/subscribed/${flow}`;
}
