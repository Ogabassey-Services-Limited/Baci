import { describe, expect, it } from 'vitest';
import nextConfig from './next.config';

describe('next.config OgaBassey resource headers', () => {
  it('emits a host-scoped mobile hero preload Link header on OgaBassey home responses', async () => {
    expect(typeof nextConfig.headers).toBe('function');
    const headers = await nextConfig.headers();
    expect(headers).toBeDefined();

    const homeLinkRules =
      headers?.filter(
        (entry) =>
          entry.source === '/' &&
          entry.headers.some((header) => header.key === 'Link')
      ) ?? [];

    expect(homeLinkRules).toHaveLength(2);

    const expectedLinkHeaderPattern =
      /^<\/_next\/static\/media\/iphone-17-pro-max-mobile\.[^./]+\.[^./]+\.avif>; rel=preload; as=image; type="image\/avif"$/;

    const linkHeaderValues = homeLinkRules.flatMap((rule) =>
      rule.headers
        .filter((header) => header.key === 'Link')
        .map((header) => header.value)
    );

    expect(linkHeaderValues).toHaveLength(2);
    expect(
      linkHeaderValues.every((value) => expectedLinkHeaderPattern.test(value))
    ).toBe(true);

    expect(homeLinkRules).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          has: [{ type: 'host', value: 'ogabassey.com' }],
        }),
        expect.objectContaining({
          has: [{ type: 'host', value: 'www.ogabassey.com' }],
        }),
      ])
    );
  });

  it('does not route OgaBassey hero assets through next.config headers matchers', async () => {
    expect(typeof nextConfig.headers).toBe('function');
    const headers = await nextConfig.headers();
    expect(headers).toBeDefined();
    const heroAssetHeaders = headers.find((entry) =>
      entry.source.includes('ogabassey-hero')
    );

    expect(heroAssetHeaders).toBeUndefined();
  });
});
