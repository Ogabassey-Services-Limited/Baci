import { describe, expect, it } from 'vitest';
import { STOREFRONT_METADATA_BLOCKING_BOT_USER_AGENT_REGEX } from './apps/web/src/config/storefront-metadata-cache-bots';
import nextConfig from './next.config';

describe('next.config htmlLimitedBots', () => {
  it('uses the storefront metadata cache classifier for HTML-limited bots', () => {
    expect(nextConfig.htmlLimitedBots).toBeDefined();
    const htmlLimitedBots = nextConfig.htmlLimitedBots;

    if (!htmlLimitedBots) {
      throw new Error('htmlLimitedBots should be defined');
    }

    expect(htmlLimitedBots).toBe(
      STOREFRONT_METADATA_BLOCKING_BOT_USER_AGENT_REGEX
    );
    expect(htmlLimitedBots.test('Googlebot/2.1')).toBe(true);
    expect(htmlLimitedBots.test('Twitterbot/1.0')).toBe(true);
    expect(htmlLimitedBots.test('Mozilla/5.0')).toBe(false);
    expect(htmlLimitedBots.test('Instagram 350.0.0.29.93 Android')).toBe(false);
    expect(htmlLimitedBots.test('baci-deploy-blog-smoke-check')).toBe(false);
    expect(htmlLimitedBots.test('AhrefsBot')).toBe(false);
    expect(htmlLimitedBots.test('')).toBe(false);
  });
});
