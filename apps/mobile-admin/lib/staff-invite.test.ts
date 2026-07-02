import { describe, expect, it } from 'vitest';
import {
  getAcceptErrorMessage,
  getFirstPreviewRow,
  TERMINAL_ACCEPT_ERRORS,
} from './staff-invite';

describe('getFirstPreviewRow', () => {
  it('returns a normalized preview from the first valid row', () => {
    const result = getFirstPreviewRow([
      {
        email: 'staff@example.com',
        role: 'sales_rep',
        merchant_business_name: 'Ogabassey',
        merchant_slug: 'ogabassey',
      },
    ]);

    expect(result).toEqual({
      email: 'staff@example.com',
      role: 'sales_rep',
      merchant_business_name: 'Ogabassey',
      merchant_slug: 'ogabassey',
    });
  });

  it('coerces missing optional business fields to null', () => {
    const result = getFirstPreviewRow([
      { email: 'staff@example.com', role: 'sales_rep' },
    ]);

    expect(result).toEqual({
      email: 'staff@example.com',
      role: 'sales_rep',
      merchant_business_name: null,
      merchant_slug: null,
    });
  });

  it('returns null for empty, non-array, or malformed rows', () => {
    expect(getFirstPreviewRow([])).toBeNull();
    expect(getFirstPreviewRow(null)).toBeNull();
    expect(getFirstPreviewRow([{ email: 'x@example.com' }])).toBeNull();
    expect(getFirstPreviewRow([{ role: 'sales_rep' }])).toBeNull();
  });
});

describe('getAcceptErrorMessage', () => {
  it('maps each known terminal error code to a friendly message', () => {
    expect(getAcceptErrorMessage('invite_expired')).toMatch(/expired/i);
    expect(getAcceptErrorMessage('invite_used')).toMatch(/already been accepted/i);
    expect(getAcceptErrorMessage('email_mismatch')).toMatch(
      /different email/i
    );
    expect(getAcceptErrorMessage('already_owner')).toMatch(/already own/i);
    expect(getAcceptErrorMessage('already_staff')).toMatch(
      /already a staff member/i
    );
  });

  it('maps invalid_invite and email_required to friendly messages', () => {
    expect(getAcceptErrorMessage('invalid_invite')).toMatch(
      /no longer valid/i
    );
    expect(getAcceptErrorMessage('email_required')).toMatch(/email address/i);
  });

  it('falls back to a generic message for unknown codes', () => {
    expect(getAcceptErrorMessage('network error')).toMatch(
      /could not accept this invitation/i
    );
  });
});

describe('TERMINAL_ACCEPT_ERRORS', () => {
  it('contains exactly the terminal acceptance codes', () => {
    expect([...TERMINAL_ACCEPT_ERRORS].sort()).toEqual(
      [
        'already_owner',
        'already_staff',
        'email_mismatch',
        'email_required',
        'invalid_invite',
        'invite_expired',
        'invite_used',
      ].sort()
    );
  });

  it('treats invalid_invite as terminal so acceptance does not retry forever', () => {
    expect(TERMINAL_ACCEPT_ERRORS.has('invalid_invite')).toBe(true);
  });
});
