import 'server-only';

import { decryptAdsToken } from '@/lib/ads/crypto';
import type { SnapchatAdsConfig } from './config';
import { SNAPCHAT_ADS_PROVIDER } from './constants';

export interface SnapchatAdsEncryptedConnection {
  access_token_ciphertext: string | null;
  refresh_token_ciphertext: string | null;
  token_expires_at: string | null;
}
export function resolveSnapchatAdsAccessToken(
  connection: SnapchatAdsEncryptedConnection,
  config: SnapchatAdsConfig
): string {
  if (!connection.access_token_ciphertext)
    throw new Error('SNAPCHAT_ADS_REAUTH_REQUIRED');
  try {
    return decryptAdsToken(
      connection.access_token_ciphertext,
      config.tokenEncryptionKey,
      SNAPCHAT_ADS_PROVIDER
    );
  } catch {
    throw new Error('SNAPCHAT_ADS_ACCESS_TOKEN_DECRYPT_FAILED');
  }
}
