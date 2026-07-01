import { storage } from './storage';

const PENDING_STAFF_INVITE_TOKEN_KEY = 'pending_staff_invite_token';

export function normalizeStaffInviteToken(
  value: string | string[] | null | undefined
): string | null {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const normalized = rawValue?.trim();
  return normalized ? normalized : null;
}

export function buildStaffInviteRoute(token: string): `/invite/${string}` {
  const normalizedToken = normalizeStaffInviteToken(token);

  if (!normalizedToken) {
    throw new TypeError('Staff invite token is required');
  }

  return `/invite/${encodeURIComponent(normalizedToken)}`;
}

export function savePendingStaffInviteToken(token: string): boolean {
  const normalizedToken = normalizeStaffInviteToken(token);

  if (!normalizedToken) {
    return false;
  }

  storage.set(PENDING_STAFF_INVITE_TOKEN_KEY, normalizedToken);
  return true;
}

export function getPendingStaffInviteToken(): string | null {
  return normalizeStaffInviteToken(
    storage.getString(PENDING_STAFF_INVITE_TOKEN_KEY)
  );
}

export function clearPendingStaffInviteToken(): void {
  storage.remove(PENDING_STAFF_INVITE_TOKEN_KEY);
}
