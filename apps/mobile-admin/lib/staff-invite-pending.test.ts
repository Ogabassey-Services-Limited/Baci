import { beforeEach, describe, expect, it, vi } from 'vitest';

const storageState = vi.hoisted(() => new Map<string, string>());

vi.mock('./storage', () => ({
  storage: {
    getString: (key: string) => storageState.get(key),
    remove: (key: string) => {
      storageState.delete(key);
    },
    set: (key: string, value: string) => {
      storageState.set(key, value);
    },
  },
}));

import {
  buildStaffInviteRoute,
  clearPendingStaffInviteToken,
  getPendingStaffInviteToken,
  normalizeStaffInviteToken,
  savePendingStaffInviteToken,
} from './staff-invite-pending';

describe('staff invite pending token helpers', () => {
  beforeEach(() => {
    storageState.clear();
  });

  it('normalizes tokens from route params', () => {
    expect(normalizeStaffInviteToken(' token-123 ')).toBe('token-123');
    expect(normalizeStaffInviteToken([' first ', 'second'])).toBe('first');
    expect(normalizeStaffInviteToken('   ')).toBeNull();
    expect(normalizeStaffInviteToken(undefined)).toBeNull();
  });

  it('builds an encoded native invite route', () => {
    expect(buildStaffInviteRoute('token with spaces')).toBe(
      '/invite/token%20with%20spaces'
    );
  });

  it('persists and clears a pending invite token', () => {
    expect(savePendingStaffInviteToken(' token-123 ')).toBe(true);
    expect(getPendingStaffInviteToken()).toBe('token-123');

    clearPendingStaffInviteToken();

    expect(getPendingStaffInviteToken()).toBeNull();
  });
});
