import { describe, expect, it } from 'vitest';
import nextConfig from './next.config';
import { OGABASSEY_HOME_HERO_PRELOAD_LINK_HEADER } from './src/config/ogabassey-hero-assets';

describe('next.config OgaBassey resource headers', () => {
  it('adds native hero preload Link headers only to OgaBassey custom-domain home routes', async () => {
    const headers = await nextConfig.headers?.();
    const findHomeHeadersForHost = (host: string) =>
      headers?.find(
        (entry) =>
          entry.source === '/' &&
          entry.has?.some(
            (condition) => condition.type === 'host' && condition.value === host
          )
      );

    const apexHomeHeaders = findHomeHeadersForHost('ogabassey.com');
    const wwwHomeHeaders = findHomeHeadersForHost('www.ogabassey.com');

    expect(apexHomeHeaders?.headers).toContainEqual({
      key: 'Link',
      value: OGABASSEY_HOME_HERO_PRELOAD_LINK_HEADER,
    });
    expect(wwwHomeHeaders?.headers).toContainEqual({
      key: 'Link',
      value: OGABASSEY_HOME_HERO_PRELOAD_LINK_HEADER,
    });
  });
});
