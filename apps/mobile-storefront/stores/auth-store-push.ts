import { createLogger } from '../lib/logger';
import { clearStoredPushToken } from '../lib/push-token-storage';
import { removePushTokenFromServer } from '../services/push-notifications';

const log = createLogger('AuthStore');

export async function clearLocalAndDeactivatePushToken(
  token: string | null
): Promise<void> {
  await clearStoredPushToken();
  if (!token) return;

  const removed = await removePushTokenFromServer(token);
  if (!removed) {
    log.warn('Push token server deactivation failed during auth transition');
  }
}
