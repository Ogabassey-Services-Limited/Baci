import { BACI_ADMIN_SCHEME } from '@baci/shared';

export const STAFF_INVITE_ACCEPT_QUERY_PARAM = 'accept';
export const STAFF_INVITE_CLIENT_QUERY_PARAM = 'client';
export const STAFF_INVITE_MOBILE_CLIENT = 'mobile';

export type StaffInviteClient = 'mobile' | 'web';

function normalizeStaffInviteToken(token: string): string {
  const normalizedToken = token.trim();

  if (!normalizedToken) {
    throw new TypeError('Staff invite token is required');
  }

  return normalizedToken;
}

export function buildStaffInvitePath(
  token: string,
  options: {
    autoAccept?: boolean;
    client?: string | null;
  } = {}
): string {
  const normalizedToken = normalizeStaffInviteToken(token);
  const url = new URL(
    `/invite/${encodeURIComponent(normalizedToken)}`,
    'https://usebaci.local'
  );

  if (options.autoAccept) {
    url.searchParams.set(STAFF_INVITE_ACCEPT_QUERY_PARAM, '1');
  }

  if (resolveStaffInviteClient(options.client) === 'mobile') {
    url.searchParams.set(
      STAFF_INVITE_CLIENT_QUERY_PARAM,
      STAFF_INVITE_MOBILE_CLIENT
    );
  }

  return `${url.pathname}${url.search}`;
}

export function resolveStaffInviteClient(
  client: string | null | undefined
): StaffInviteClient {
  return client?.trim().toLowerCase() === STAFF_INVITE_MOBILE_CLIENT
    ? 'mobile'
    : 'web';
}

export function resolveStaffPostAcceptRedirect(
  client: string | null | undefined
): string {
  return resolveStaffInviteClient(client) === 'mobile'
    ? `${BACI_ADMIN_SCHEME}://`
    : '/dashboard';
}
