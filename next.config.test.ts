import { describe, expect, it } from 'vitest';
import nextConfig from './next.config';

describe('next.config htmlLimitedBots', () => {
  it('treats Ahrefs crawlers as HTML-limited bots', () => {
    expect(nextConfig.htmlLimitedBots?.test('AhrefsBot')).toBe(true);
    expect(nextConfig.htmlLimitedBots?.test('AhrefsSiteAudit')).toBe(true);
    expect(nextConfig.htmlLimitedBots?.test('ahrefsbot')).toBe(true);
    expect(nextConfig.htmlLimitedBots?.test('AHREFSBOT')).toBe(true);
    expect(nextConfig.htmlLimitedBots?.test('AhReFsSiTeAuDiT')).toBe(true);
    expect(nextConfig.htmlLimitedBots?.test('Mozilla/5.0')).toBe(false);
  });
});
