// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
  OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
} from '@/components/storefront/ogabassey/config/product-media';

vi.mock('server-only', () => ({}));

// Restore the REAL next/image getImageProps (the global vitest.setup mocks
// next/image with only a `default` export) so both the rendered <picture> and
// the preload hint build their srcSets through the identical production path.
vi.mock('next/image', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/image')>();
  return { ...actual };
});

const preloadMock = vi.hoisted(() => vi.fn());

vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom')>();
  return {
    ...actual,
    preconnect: vi.fn(),
    prefetchDNS: vi.fn(),
    preload: preloadMock,
  };
});

import { CdnFormatImage } from '@/components/storefront/cdn-format-image';
import { preloadOgabasseyPdpProductResources } from './ogabassey-pdp-product-resource-hints';

const CDN_PRODUCT_IMAGE =
  'https://cdn.ogabassey.com/core-assets/products/z-fold-7.avif';

/** Case-insensitive extraction of the AVIF `<source>`'s srcset from markup. */
function extractAvifSourceSrcSet(markup: string): string {
  const match = markup.match(
    /<source[^>]*type="image\/avif"[^>]*\ssrcset="([^"]*)"/i
  );
  // React may serialize the attributes in either order — try the reverse too.
  if (match?.[1]) {
    return match[1];
  }
  const reverse = markup.match(
    /<source[^>]*\ssrcset="([^"]*)"[^>]*type="image\/avif"/i
  );
  return reverse?.[1] ?? '';
}

describe('OgaBassey PDP image preload-vs-render parity', () => {
  beforeEach(() => {
    preloadMock.mockClear();
  });

  it('renders and preloads a byte-identical AVIF srcSet through the shared builders', () => {
    // RENDER side: what the PDP hero <picture> paints for AVIF-capable browsers.
    const markup = renderToStaticMarkup(
      <CdnFormatImage
        alt=""
        fill
        quality={OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY}
        sizes={OGABASSEY_PDP_PRIMARY_IMAGE_SIZES}
        src={CDN_PRODUCT_IMAGE}
      />
    );
    const renderedAvifSrcSet = extractAvifSourceSrcSet(markup);

    // PRELOAD side: the resource-hint the shell emits for the same image.
    preloadOgabasseyPdpProductResources({ src: CDN_PRODUCT_IMAGE });
    expect(preloadMock).toHaveBeenCalledTimes(1);
    const [, options] = preloadMock.mock.calls[0] as [
      string,
      { imageSrcSet?: string; type?: string },
    ];
    const preloadedAvifSrcSet = options.imageSrcSet ?? '';

    // Both sides must be non-empty explicit AVIF, and byte-identical.
    expect(renderedAvifSrcSet).not.toBe('');
    expect(renderedAvifSrcSet).toContain('format=avif');
    expect(options.type).toBe('image/avif');
    expect(preloadedAvifSrcSet).toBe(renderedAvifSrcSet);

    // Neither side may reintroduce the poisonable auto/jpeg cache keys.
    for (const srcSet of [renderedAvifSrcSet, preloadedAvifSrcSet]) {
      expect(srcSet).not.toContain('format=auto');
      expect(srcSet).not.toContain('format=jpeg');
      expect(srcSet).not.toContain('format=png');
    }
  });
});
