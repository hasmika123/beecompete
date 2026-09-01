'use client';

import { Alert, Button, Modal } from '@beecompete/ui';
import { enumLabel } from '@/components/admin/enum-labels';
import type { Organization } from '@/lib/admin-types';

/**
 * "Organization created" — the confirmation for BOTH create paths (owner 2026-08-28): the standalone
 * /admin/organizations/new page, and the add-organization step inside the create-listing form.
 *
 * One component on purpose. The two paths differ only in where dismissing it takes you, and the
 * request was explicitly that they show the same message — a curator who has just created an
 * organization from inside a listing should recognize what they are looking at.
 *
 * Modal carries the ✕ (and Escape, and the focus trap) already, so `onClose` is the single exit:
 * the ✕, the backdrop, Escape and the footer button all run it. Whatever the caller does there IS
 * the "and then go back to…" half of the flow.
 */
export function OrganizationCreatedModal({
  organization,
  onClose,
  returnLabel,
}: {
  /** The created row; the modal is open exactly when there is one. */
  organization: Organization | null;
  onClose: () => void;
  /** Footer button copy — say where dismissing lands, since the two paths land differently. */
  returnLabel: string;
}) {
  return (
    <Modal
      open={organization !== null}
      onClose={onClose}
      title="Organization created"
      className="max-w-lg"
      footer={<Button onClick={onClose}>{returnLabel}</Button>}
    >
      {organization && (
        <Alert tone="success" title={organization.name}>
          <ul className="grid gap-0.5">
            <li>Type: {enumLabel(organization.type)}</li>
            <li>
              {/* The stored value, not what was typed: the server reduces a pasted address to its
                  domain, and showing the result is how a curator finds out. */}
              Official website: {organization.domain ?? 'not recorded'}
            </li>
          </ul>
        </Alert>
      )}
    </Modal>
  );
}
