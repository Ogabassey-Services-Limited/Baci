import { describe, expect, it } from 'vitest';
import nextConfig from './next.config';

describe('next.config htmlLimitedBots', () => {
  it('treats Ahrefs crawlers as HTML-limited bots', () => {
    expect(nextConfig.htmlLimitedBots).toBeDefined();
    const htmlLimitedBots = nextConfig.htmlLimitedBots;

    if (!htmlLimitedBots) {
      throw new Error('htmlLimitedBots should be defined');
    }

    expect(htmlLimitedBots.test('AhrefsBot')).toBe(true);
    expect(htmlLimitedBots.test('ahrefsbot')).toBe(true);
    expect(htmlLimitedBots.test('AhrefsSiteAudit')).toBe(true);
    expect(htmlLimitedBots.test('Mozilla/5.0')).toBe(false);
  });
});
