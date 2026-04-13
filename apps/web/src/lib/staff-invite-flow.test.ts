import { describe, expect, it } from 'vitest';
import {
  buildStaffInvitePath,
  resolveStaffInviteClient,
  resolveStaffPostAcceptRedirect,
} from '@/lib/staff-invite-flow';

describe('buildStaffInvitePath', () => {
  it('builds the canonical invite path', () => {
    expect(buildStaffInvitePath('token-123')).toBe('/invite/token-123');
  });

  it('adds auto-accept and mobile client query params when requested', () => {
    expect(
      buildStaffInvitePath('token-123', {
        autoAccept: true,
        client: 'mobile',
      })
    ).toBe('/invite/token-123?accept=1&client=mobile');
  });

  it('supports individual query flags and encodes special characters', () => {
    expect(buildStaffInvitePath('token-123', { autoAccept: true })).toBe(
      '/invite/token-123?accept=1'
    );
    expect(buildStaffInvitePath('token-123', { client: 'mobile' })).toBe(
      '/invite/token-123?client=mobile'
    );
    expect(buildStaffInvitePath('token/with spaces')).toBe(
      '/invite/token%2Fwith%20spaces'
    );
  });
});

describe('resolveStaffInviteClient', () => {
  it('defaults unknown clients to web', () => {
    expect(resolveStaffInviteClient(null)).toBe('web');
    expect(resolveStaffInviteClient('tablet')).toBe('web');
  });

  it('preserves the mobile client marker', () => {
    expect(resolveStaffInviteClient('mobile')).toBe('mobile');
  });
});

describe('resolveStaffPostAcceptRedirect', () => {
  it('routes mobile invite completions back to the app', () => {
    expect(resolveStaffPostAcceptRedirect('mobile')).toBe('baciadmin://');
  });

  it('routes web invite completions to the dashboard', () => {
    expect(resolveStaffPostAcceptRedirect('web')).toBe('/dashboard');
  });
});
