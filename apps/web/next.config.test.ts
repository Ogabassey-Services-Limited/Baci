import { describe, expect, it } from 'vitest';
import {
  OGABASSEY_HERO_ASSET_CACHE_CONTROL,
  OGABASSEY_HOME_HERO_PRELOAD_LINK_HEADER,
} from '@/config/ogabassey-hero-assets';
import nextConfig from './next.config';

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
    const unrelatedHomeHeaders = findHomeHeadersForHost('example.com');

    expect(apexHomeHeaders?.headers).toContainEqual({
      key: 'Link',
      value: OGABASSEY_HOME_HERO_PRELOAD_LINK_HEADER,
    });
    expect(wwwHomeHeaders?.headers).toContainEqual({
      key: 'Link',
      value: OGABASSEY_HOME_HERO_PRELOAD_LINK_HEADER,
    });
    expect(unrelatedHomeHeaders).toBeUndefined();

    const homeLinkRules =
      headers?.filter(
        (entry) =>
          entry.source === '/' &&
          entry.headers.some(
            (header) =>
              header.key === 'Link' &&
              header.value === OGABASSEY_HOME_HERO_PRELOAD_LINK_HEADER
          )
      ) ?? [];
    const linkHosts = homeLinkRules
      .map(
        (entry) =>
          entry.has?.find((condition) => condition.type === 'host')?.value
      )
      .sort();

    expect(linkHosts).toEqual(['ogabassey.com', 'www.ogabassey.com']);
    const nonHomeRouteHeaders =
      headers
        ?.filter((entry) => entry.source !== '/')
        .flatMap((entry) => entry.headers) ?? [];

    expect(nonHomeRouteHeaders).not.toContainEqual({
      key: 'Link',
      value: OGABASSEY_HOME_HERO_PRELOAD_LINK_HEADER,
    });
  });

  it('sets immutable browser caching for versioned OgaBassey public hero assets', async () => {
    const headers = await nextConfig.headers?.();
    const heroAssetHeaders = headers?.find(
      (entry) => entry.source === '/ogabassey/hero/:path*'
    );

    expect(heroAssetHeaders?.headers).toContainEqual({
      key: 'Cache-Control',
      value: OGABASSEY_HERO_ASSET_CACHE_CONTROL,
    });
  });
});
