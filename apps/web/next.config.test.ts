import { describe, expect, it } from 'vitest';
import nextConfig from './next.config';

describe('next.config OgaBassey resource headers', () => {
  it('does not guess viewport-specific hero preloads from request headers', async () => {
    const headers = await nextConfig.headers?.();

    const homeLinkRules =
      headers?.filter(
        (entry) =>
          entry.source === '/' &&
          entry.headers.some((header) => header.key === 'Link')
      ) ?? [];

    expect(homeLinkRules).toHaveLength(0);
  });

  it('does not route OgaBassey hero assets through next.config headers matchers', async () => {
    const headers = await nextConfig.headers?.();
    const heroAssetHeaders = headers?.find((entry) =>
      entry.source.includes('ogabassey-hero')
    );

    expect(heroAssetHeaders).toBeUndefined();
  });
});
