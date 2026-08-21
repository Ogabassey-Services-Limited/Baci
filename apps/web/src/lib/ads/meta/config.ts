import 'server-only';

import { getCanonicalAdsCallbackUri } from '@/lib/ads/config';
import { META_ADS_PROVIDER } from './constants';

export const META_ADS_CONFIG_MISSING = 'Meta Ads integration is not configured';

export interface MetaAdsConfig {
  appId: string;
  appSecret: string;
  oauthStateSecret: string;
  redirectUri: string;
  tokenEncryptionKey: string;
}

export class MetaAdsConfigError extends Error {
  readonly code = 'META_ADS_CONFIG_MISSING';

  constructor(message: string) {
    super(message);
    this.name = 'MetaAdsConfigError';
  }
}

function readRequired(name: string, minimumLength = 1): string {
  const value = process.env[name]?.trim();
  if (!value || value.length < minimumLength) {
    throw new MetaAdsConfigError(`Missing ${name}`);
  }
  return value;
}

export function getMetaAdsConfig(): MetaAdsConfig {
  return {
    appId: readRequired('META_ADS_APP_ID'),
    appSecret: readRequired('META_ADS_APP_SECRET'),
    oauthStateSecret: readRequired('META_ADS_STATE_SECRET', 32),
    redirectUri: getCanonicalAdsCallbackUri(META_ADS_PROVIDER),
    tokenEncryptionKey: readRequired('META_ADS_TOKEN_ENCRYPTION_KEY'),
  };
}
