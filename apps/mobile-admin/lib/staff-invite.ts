/**
 * Shared types and helpers for the staff invite acceptance screen.
 * Kept separate from the screen component so `app/invite/[token].tsx` stays
 * within the repo's 300-line module limit.
 */

export interface InvitePreview {
  email: string;
  merchant_business_name: string | null;
  merchant_slug?: string | null;
  role: string;
}

// What the error screen's primary button should do.
//  - 'retry': transient failure (network/unknown). Keep the pending token and
//    let the user re-run the flow.
//  - 'switch_account': signed in as the wrong account. Preserve the token, sign
//    out, and send them to login so re-authenticating resumes the invite.
//  - 'dismiss': terminal failure (invalid/used/expired). Token already cleared.
export type InviteErrorAction = 'retry' | 'switch_account' | 'dismiss';

export type InviteState =
  | { status: 'loading'; message: string }
  | {
      status: 'error';
      message: string;
      title: string;
      action: InviteErrorAction;
    }
  | { status: 'success'; message: string; title: string };

// Terminal acceptance errors raised by accept_staff_invite. Anything else
// (network blips, unexpected server errors) is treated as retryable so a valid
// invite is never discarded on a transient failure.
export const TERMINAL_ACCEPT_ERRORS = new Set([
  'invite_expired',
  'invite_used',
  'email_mismatch',
  'already_owner',
  'already_staff',
]);

export function getFirstPreviewRow(rows: unknown): InvitePreview | null {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const row = rows[0] as Partial<InvitePreview>;

  if (typeof row.email !== 'string' || typeof row.role !== 'string') {
    return null;
  }

  return {
    email: row.email,
    merchant_business_name:
      typeof row.merchant_business_name === 'string'
        ? row.merchant_business_name
        : null,
    merchant_slug:
      typeof row.merchant_slug === 'string' ? row.merchant_slug : null,
    role: row.role,
  };
}

export function getAcceptErrorMessage(message: string): string {
  if (message === 'invite_expired') {
    return 'This invitation has expired. Ask the store owner to send a new one.';
  }

  if (message === 'invite_used') {
    return 'This invitation has already been accepted.';
  }

  if (message === 'email_mismatch') {
    return 'This invitation belongs to a different email address.';
  }

  if (message === 'already_owner') {
    return 'You already own this store.';
  }

  if (message === 'already_staff') {
    return 'You are already a staff member of this store.';
  }

  return 'We could not accept this invitation. Please try again.';
}
