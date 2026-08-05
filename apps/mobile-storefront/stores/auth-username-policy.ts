import { profileRpcErrorMessages } from './auth-store-error-messages';

export function getUsernamePolicyError(error: {
  details?: string;
  message: string;
}) {
  if (error.message === 'username_change_active_attempt')
    return 'Finish your active quiz before changing your username.';
  if (error.message !== 'username_change_cooldown')
    return profileRpcErrorMessages.username(error.message);
  const timestamp = Date.parse(error.details ?? '');
  return Number.isFinite(timestamp)
    ? `You can change your username again on ${new Intl.DateTimeFormat(
        undefined,
        { dateStyle: 'medium' }
      ).format(timestamp)}.`
    : 'You can change your username once every 30 days.';
}

export function getUsernameCooldownNextEligibleAt(error: {
  details?: string;
  message: string;
}) {
  if (error.message !== 'username_change_cooldown') return null;
  return Number.isFinite(Date.parse(error.details ?? ''))
    ? (error.details ?? null)
    : null;
}

export function parseUsernameWriteResult(data: unknown) {
  if (!data || typeof data !== 'object') return null;
  const value = data as Record<string, unknown>;
  if (typeof value.username !== 'string') return null;
  return {
    username: value.username,
    usernameChangedAt:
      typeof value.usernameChangedAt === 'string'
        ? value.usernameChangedAt
        : null,
    nextEligibleAt:
      typeof value.nextEligibleAt === 'string' ? value.nextEligibleAt : null,
  };
}
