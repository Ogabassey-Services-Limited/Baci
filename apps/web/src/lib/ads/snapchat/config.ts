import 'server-only';

import { getCanonicalAdsCallbackUri } from '@/lib/ads/config';
import { SNAPCHAT_ADS_PROVIDER } from './constants';

export const SNAPCHAT_ADS_CONFIG_MISSING =
  'Snapchat Ads integration is not configured';

export interface SnapchatAdsConfig {
  clientId: string;
  clientSecret: string;
  oauthStateSecret: string;
  redirectUri: string;
  tokenEncryptionKey: string;
}
export class SnapchatAdsConfigError extends Error {
  readonly code = 'SNAPCHAT_ADS_CONFIG_MISSING';
  constructor(message: string) {
    super(message);
    this.name = 'SnapchatAdsConfigError';
  }
}
function required(name: string, minimumLength = 1): string {
  const value = process.env[name]?.trim();
  if (!value || value.length < minimumLength)
    throw new SnapchatAdsConfigError(`Missing ${name}`);
  return value;
}
export function getSnapchatAdsConfig(): SnapchatAdsConfig {
  return {
    clientId: required('SNAPCHAT_ADS_CLIENT_ID'),
    clientSecret: required('SNAPCHAT_ADS_CLIENT_SECRET'),
    oauthStateSecret: required('SNAPCHAT_ADS_STATE_SECRET', 32),
    redirectUri: getCanonicalAdsCallbackUri(SNAPCHAT_ADS_PROVIDER),
    tokenEncryptionKey: required('SNAPCHAT_ADS_TOKEN_ENCRYPTION_KEY'),
  };
}
