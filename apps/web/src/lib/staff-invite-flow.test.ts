import { describe, expect, it } from 'vitest';
import {
  buildStaffInvitePath,
  resolveStaffInviteClient,
  resolveStaffPostAcceptRedirect,
  STAFF_INVITE_MOBILE_CLIENT,
} from '@/lib/staff-invite-flow';

describe('buildStaffInvitePath', () => {
  it('builds the canonical invite path', () => {
    expect(buildStaffInvitePath('token-123')).toBe('/invite/token-123');
  });

  it('adds auto-accept and mobile client query params when requested', () => {
    expect(
      buildStaffInvitePath('token-123', {
        autoAccept: true,
        client: STAFF_INVITE_MOBILE_CLIENT,
      })
    ).toBe('/invite/token-123?accept=1&client=mobile');
  });

  it('supports individual query flags and encodes special characters', () => {
    expect(buildStaffInvitePath('token-123', { autoAccept: true })).toBe(
      '/invite/token-123?accept=1'
    );
    expect(
      buildStaffInvitePath('token-123', {
        client: STAFF_INVITE_MOBILE_CLIENT,
      })
    ).toBe('/invite/token-123?client=mobile');
    expect(buildStaffInvitePath('token/with spaces')).toBe(
      '/invite/token%2Fwith%20spaces'
    );
    expect(buildStaffInvitePath('token+plus?equals=1')).toBe(
      '/invite/token%2Bplus%3Fequals%3D1'
    );
  });

  it('rejects blank invite tokens', () => {
    expect(() => buildStaffInvitePath('   ')).toThrowError(
      'Staff invite token is required'
    );
  });
});

describe('resolveStaffInviteClient', () => {
  it('defaults unknown clients to web', () => {
    expect(resolveStaffInviteClient(null)).toBe('web');
    expect(resolveStaffInviteClient('tablet')).toBe('web');
  });

  it('normalizes the mobile client marker case-insensitively', () => {
    expect(resolveStaffInviteClient(STAFF_INVITE_MOBILE_CLIENT)).toBe('mobile');
    expect(resolveStaffInviteClient(' MOBILE ')).toBe('mobile');
  });
});

describe('resolveStaffPostAcceptRedirect', () => {
  it('routes mobile invite completions back to the app', () => {
    expect(resolveStaffPostAcceptRedirect(STAFF_INVITE_MOBILE_CLIENT)).toBe(
      'baciadmin://'
    );
  });

  it('routes web invite completions to the dashboard', () => {
    expect(resolveStaffPostAcceptRedirect('web')).toBe('/dashboard');
  });
});
