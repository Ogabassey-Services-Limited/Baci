import { describe, expect, it } from 'vitest';
import { collectPublicProjectionReleaseAssetUrls } from './collect-public-projection-release-asset-urls';

const firstAsset = `/release-assets/${'a'.repeat(64)}.png`;
const secondAsset = `/release-assets/${'b'.repeat(64)}.webp`;

describe('collectPublicProjectionReleaseAssetUrls', () => {
  it('collects valid asset paths from nested content and de-duplicates them', () => {
    const value = {
      blocks: [
        { body: `hero ${firstAsset}` },
        { body: `repeat ${firstAsset} ${secondAsset}` },
      ],
      ignored: '/release-assets/not-a-content-address.png',
    };

    expect(collectPublicProjectionReleaseAssetUrls(value)).toEqual(
      new Set([firstAsset, secondAsset])
    );
  });

  it('terminates safely when bounded content contains a cycle', () => {
    const value: { body: string; self?: unknown } = { body: firstAsset };
    value.self = value;

    expect(collectPublicProjectionReleaseAssetUrls(value)).toEqual(
      new Set([firstAsset])
    );
  });

  it('does not collect a release-asset prefix from a suffixed filename', () => {
    expect(
      collectPublicProjectionReleaseAssetUrls(
        `https://cdn.shopify.com${firstAsset}.bak`
      )
    ).toEqual(new Set());
  });
});
