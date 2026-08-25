import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { decryptAdsToken, encryptAdsToken } from '@/lib/ads/crypto';
import type { SnapchatAdsConfig } from './config';
import { SNAPCHAT_ADS_PROVIDER } from './constants';
import { refreshSnapchatAdsAccessToken, type SnapchatAdsGrant } from './oauth';

const SNAPCHAT_ADS_TOKEN_REFRESH_SAFETY_WINDOW_MS = 60_000;

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

export function resolveSnapchatAdsRefreshToken(
  connection: SnapchatAdsEncryptedConnection,
  config: SnapchatAdsConfig
): string {
  if (!connection.refresh_token_ciphertext)
    throw new Error('SNAPCHAT_ADS_REAUTH_REQUIRED');
  try {
    return decryptAdsToken(
      connection.refresh_token_ciphertext,
      config.tokenEncryptionKey,
      SNAPCHAT_ADS_PROVIDER
    );
  } catch {
    throw new Error('SNAPCHAT_ADS_REFRESH_TOKEN_DECRYPT_FAILED');
  }
}

export class SnapchatAdsTokenRefreshError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'SnapchatAdsTokenRefreshError';
  }
}

export async function getSnapchatAdsUsableAccessToken(input: {
  config: SnapchatAdsConfig;
  connection: SnapchatAdsEncryptedConnection;
  merchantId: string;
  supabase: SupabaseClient;
}): Promise<string> {
  const token = resolveSnapchatAdsAccessToken(input.connection, input.config);
  const expiresAt = input.connection.token_expires_at
    ? Date.parse(input.connection.token_expires_at)
    : Number.NaN;
  if (
    !Number.isFinite(expiresAt) ||
    expiresAt > Date.now() + SNAPCHAT_ADS_TOKEN_REFRESH_SAFETY_WINDOW_MS
  )
    return token;
  if (!input.connection.refresh_token_ciphertext)
    throw new SnapchatAdsTokenRefreshError('SNAPCHAT_ADS_REFRESH_REJECTED');
  let grant: SnapchatAdsGrant;
  try {
    grant = await refreshSnapchatAdsAccessToken({
      ...input.config,
      refreshToken: resolveSnapchatAdsRefreshToken(
        input.connection,
        input.config
      ),
    });
  } catch (error) {
    const status =
      error &&
      typeof error === 'object' &&
      typeof (error as { status?: unknown }).status === 'number'
        ? (error as { status: number }).status
        : undefined;
    throw new SnapchatAdsTokenRefreshError(
      status === 400 || status === 401 || status === 403
        ? 'SNAPCHAT_ADS_REFRESH_REJECTED'
        : 'SNAPCHAT_ADS_REFRESH_FAILED'
    );
  }
  const updated = await input.supabase.rpc(
    'update_snapchat_ads_connection_tokens',
    {
      p_access_token_ciphertext: encryptAdsToken(
        grant.accessToken,
        input.config.tokenEncryptionKey,
        SNAPCHAT_ADS_PROVIDER
      ),
      p_current_refresh_token_ciphertext:
        input.connection.refresh_token_ciphertext,
      p_merchant_id: input.merchantId,
      p_refresh_token_ciphertext: encryptAdsToken(
        grant.refreshToken,
        input.config.tokenEncryptionKey,
        SNAPCHAT_ADS_PROVIDER
      ),
      p_token_expires_at: new Date(
        Date.now() + grant.expiresIn * 1000
      ).toISOString(),
    }
  );
  if (updated.error || updated.data !== true)
    throw new SnapchatAdsTokenRefreshError(
      'SNAPCHAT_ADS_TOKEN_REFRESH_WRITE_FAILED'
    );
  return grant.accessToken;
}
