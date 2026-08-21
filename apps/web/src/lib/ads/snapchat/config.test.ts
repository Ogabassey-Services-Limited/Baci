import { describe, expect, it } from 'vitest';
import { getSnapchatAdsConfig } from './config';

describe('Snapchat Ads config', () => {
  it('fails closed when server-only OAuth configuration is absent', () => {
    expect(() => getSnapchatAdsConfig()).toThrow('SNAPCHAT_ADS');
  });
});
