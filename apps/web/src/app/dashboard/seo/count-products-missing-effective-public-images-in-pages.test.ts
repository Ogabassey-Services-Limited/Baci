import { describe, expect, it } from 'vitest';
import { countProductsMissingEffectivePublicImagesInPages } from './count-products-missing-effective-public-images-in-pages';

const PAGE_SIZE = 250;

describe('countProductsMissingEffectivePublicImagesInPages', () => {
  it('continues through a full page before returning the missing-media count', async () => {
    const ranges: Array<{ from: number; to: number }> = [];
    const fetchPage = async ({ from, to }: { from: number; to: number }) => {
      ranges.push({ from, to });
      if (from === 0) {
        return {
          data: Array.from({ length: PAGE_SIZE }, () => ({
            images: [],
            product_variants: [],
          })),
          error: null,
        };
      }

      return {
        data: [
          {
            images: [{ url: 'https://cdn.example.com/second-page.webp' }],
            product_variants: [],
          },
        ],
        error: null,
      };
    };

    const result =
      await countProductsMissingEffectivePublicImagesInPages(fetchPage);

    expect(result).toBe(PAGE_SIZE);
    expect(ranges).toEqual([
      { from: 0, to: PAGE_SIZE - 1 },
      { from: PAGE_SIZE, to: PAGE_SIZE * 2 - 1 },
    ]);
  });

  it('fails closed when an image-source page cannot be loaded', async () => {
    const result = countProductsMissingEffectivePublicImagesInPages(
      async () => ({ data: null, error: { message: 'catalog unavailable' } })
    );

    await expect(result).rejects.toThrow('catalog unavailable');
  });
});
