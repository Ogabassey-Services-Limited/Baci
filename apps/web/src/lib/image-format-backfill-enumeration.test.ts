import { describe, expect, it } from 'vitest';
import {
  enumerateImageFormatBackfillTargets,
  type ImageFormatBackfillSupabaseClient,
} from '@/lib/image-format-backfill-enumeration';
import { buildOgabasseyPrewarmTransformUrls } from '@/lib/ogabassey-image-prewarm';
import { BLOG_IMAGE_WIDTH_QUALITY_PAIRS } from '@/lib/ogabassey-image-prewarm-pairs';

const CDN_PRODUCT_IMAGE_A =
  'https://cdn.ogabassey.com/core-assets/products/phone.avif';
const CDN_PRODUCT_IMAGE_B =
  'https://cdn.ogabassey.com/core-assets/products/laptop.jpg';
const CDN_BLOG_IMAGE = 'https://cdn.ogabassey.com/core-assets/blog/hero.avif';
const NON_CDN_IMAGE = 'https://cdn.example.com/products/phone.avif';

interface BackfillSupabaseStubConfig {
  /** Pages (max 1000 rows each) returned for `products`. */
  productPages?: Record<string, unknown>[][];
  /** Pages (max 1000 rows each) returned for `blog_posts`. */
  blogPostPages?: Record<string, unknown>[][];
  productsError?: { message: string };
  blogPostsError?: { message: string };
}

interface RecordedRangeCall {
  table: string;
  columns: string;
  eq: [column: string, value: string];
  range: [from: number, to: number];
}

// Duplicated (in reduced form) in image-format-backfill.test.ts: the
// Stop-hook quality gate requires a colocated test for every non-test source
// file, so a shared *.test-utils.ts module is not an option here.
function createBackfillSupabaseStub(config: BackfillSupabaseStubConfig = {}): {
  calls: RecordedRangeCall[];
  client: ImageFormatBackfillSupabaseClient;
} {
  const calls: RecordedRangeCall[] = [];

  const client: ImageFormatBackfillSupabaseClient = {
    from(table: string) {
      return {
        select(columns: string) {
          let eqArgs: [string, string] = ['', ''];
          const builder = {
            order() {
              return this;
            },
            eq(column: string, value: string) {
              eqArgs = [column, value];
              return builder;
            },
            range(from: number, to: number) {
              calls.push({ table, columns, eq: eqArgs, range: [from, to] });
              const isProducts = table === 'products';
              const error = isProducts
                ? config.productsError
                : config.blogPostsError;
              if (error) {
                return Promise.resolve({ data: null, error });
              }
              const pages =
                (isProducts ? config.productPages : config.blogPostPages) ?? [];
              return Promise.resolve({
                data: pages[Math.floor(from / 1000)] ?? [],
                error: null,
              });
            },
          };
          return builder;
        },
      };
    },
  };

  return { calls, client };
}

function productVariantUrls(imagePath: string): string[] {
  return Array.from(
    new Set(
      buildOgabasseyPrewarmTransformUrls(imagePath, undefined, {
        format: 'auto',
      })
    )
  );
}

function blogVariantUrls(imagePath: string): string[] {
  return Array.from(
    new Set(
      buildOgabasseyPrewarmTransformUrls(
        imagePath,
        BLOG_IMAGE_WIDTH_QUALITY_PAIRS,
        { format: 'auto' }
      )
    )
  );
}

describe('enumerateImageFormatBackfillTargets', () => {
  it('expands each product primary image into the product default variant matrix', async () => {
    const { client } = createBackfillSupabaseStub({
      productPages: [
        [
          { id: 'p1', images: [CDN_PRODUCT_IMAGE_A] },
          { id: 'p2', images: [{ url: CDN_PRODUCT_IMAGE_B }] },
        ],
      ],
    });

    const targets = await enumerateImageFormatBackfillTargets(client);

    expect(targets.productCount).toBe(2);
    expect(targets.blogPostCount).toBe(0);
    expect(targets.urls).toEqual([
      ...productVariantUrls(CDN_PRODUCT_IMAGE_A),
      ...productVariantUrls(CDN_PRODUCT_IMAGE_B),
    ]);
  });

  it('uses only the primary (first valid) image per product', async () => {
    const { client } = createBackfillSupabaseStub({
      productPages: [
        [{ id: 'p1', images: ['', CDN_PRODUCT_IMAGE_A, CDN_PRODUCT_IMAGE_B] }],
      ],
    });

    const targets = await enumerateImageFormatBackfillTargets(client);

    expect(targets.urls).toEqual(productVariantUrls(CDN_PRODUCT_IMAGE_A));
  });

  it('expands blog featured images with the blog width-quality pairs', async () => {
    const { client } = createBackfillSupabaseStub({
      blogPostPages: [[{ featured_image_url: CDN_BLOG_IMAGE }]],
    });

    const targets = await enumerateImageFormatBackfillTargets(client);

    expect(targets.blogPostCount).toBe(1);
    expect(targets.urls).toEqual(blogVariantUrls(CDN_BLOG_IMAGE));
    expect(targets.urls.length).toBeGreaterThan(0);
  });

  it('enumerates legacy format=auto URLs because the backfill targets poisoned Accept-negotiated cache entries', async () => {
    const { client } = createBackfillSupabaseStub({
      productPages: [[{ id: 'p1', images: [CDN_PRODUCT_IMAGE_A] }]],
      blogPostPages: [[{ featured_image_url: CDN_BLOG_IMAGE }]],
    });

    const targets = await enumerateImageFormatBackfillTargets(client);

    expect(targets.urls.length).toBeGreaterThan(0);
    expect(targets.urls.every((url) => url.includes('format=auto'))).toBe(true);
    expect(targets.urls.some((url) => url.includes('format=jpeg'))).toBe(false);
    expect(targets.urls.some((url) => url.includes('format=png'))).toBe(false);
  });

  it('scans queried tables with the expected columns and status filters', async () => {
    const { calls, client } = createBackfillSupabaseStub();

    await enumerateImageFormatBackfillTargets(client);

    expect(calls).toEqual([
      {
        table: 'products',
        columns:
          'id, images, price, manage_stock, product_variants!product_variants_product_id_fkey(id, primary_image, images, price_override, stock_quantity)',
        eq: ['status', 'active'],
        range: [0, 999],
      },
      {
        table: 'blog_posts',
        columns: 'featured_image_url',
        eq: ['status', 'published'],
        range: [0, 999],
      },
    ]);
  });

  it('includes the LOWEST-PRICED purchasable variant image alongside the product primary', async () => {
    // The PDP opens on the lowest-priced purchasable variant
    // (resolveLowestPricedVariantSelection) and renders ITS image above the
    // fold — not the first embedded row's. variant-b is cheaper here, so its
    // image is the LCP URL that must be checked.
    const { client } = createBackfillSupabaseStub({
      productPages: [
        [
          {
            id: 'p1',
            images: [
              'https://cdn.ogabassey.com/core-assets/products/parent.avif',
            ],
            price: 1000,
            manage_stock: true,
            product_variants: [
              {
                id: 'v-a',
                primary_image:
                  'https://cdn.ogabassey.com/core-assets/products/variant-a.avif',
                images: [],
                price_override: 900,
                stock_quantity: 5,
              },
              {
                id: 'v-b',
                primary_image:
                  'https://cdn.ogabassey.com/core-assets/products/variant-b.avif',
                images: [],
                price_override: 700,
                stock_quantity: 5,
              },
            ],
          },
        ],
      ],
    });

    const targets = await enumerateImageFormatBackfillTargets(client);

    expect(targets.urls.some((url) => url.includes('parent.avif'))).toBe(true);
    expect(targets.urls.some((url) => url.includes('variant-b.avif'))).toBe(
      true
    );
    // Non-default variants only render on user interaction — deliberately
    // excluded to keep the run bounded.
    expect(targets.urls.some((url) => url.includes('variant-a.avif'))).toBe(
      false
    );
  });

  it('dedupes identical variant URLs shared by multiple products', async () => {
    const { client } = createBackfillSupabaseStub({
      productPages: [
        [
          { id: 'p1', images: [CDN_PRODUCT_IMAGE_A] },
          { id: 'p2', images: [CDN_PRODUCT_IMAGE_A] },
        ],
      ],
    });

    const targets = await enumerateImageFormatBackfillTargets(client);

    expect(targets.productCount).toBe(2);
    expect(targets.urls).toEqual(productVariantUrls(CDN_PRODUCT_IMAGE_A));
  });

  it('skips rows without a usable image while still counting them as scanned', async () => {
    const { client } = createBackfillSupabaseStub({
      productPages: [
        [
          { id: 'p1', images: null },
          { id: 'p2', images: [] },
          { id: 'p3', images: [NON_CDN_IMAGE] },
        ],
      ],
      blogPostPages: [[{ featured_image_url: null }]],
    });

    const targets = await enumerateImageFormatBackfillTargets(client);

    expect(targets.productCount).toBe(3);
    expect(targets.blogPostCount).toBe(1);
    expect(targets.urls).toEqual([]);
  });

  it('paginates products beyond the 1000-row page size', async () => {
    const fullPage = Array.from({ length: 1000 }, (_, index) => ({
      id: `p${index}`,
      images: null,
    }));
    const { calls, client } = createBackfillSupabaseStub({
      productPages: [
        fullPage,
        [{ id: 'p1000', images: [CDN_PRODUCT_IMAGE_A] }],
      ],
    });

    const targets = await enumerateImageFormatBackfillTargets(client);

    expect(targets.productCount).toBe(1001);
    expect(targets.urls).toEqual(productVariantUrls(CDN_PRODUCT_IMAGE_A));
    const productRanges = calls
      .filter((call) => call.table === 'products')
      .map((call) => call.range);
    expect(productRanges).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it('honors the product limit without capping blog posts', async () => {
    const { client } = createBackfillSupabaseStub({
      productPages: [
        [
          { id: 'p1', images: [CDN_PRODUCT_IMAGE_A] },
          { id: 'p2', images: [CDN_PRODUCT_IMAGE_B] },
          { id: 'p3', images: [CDN_PRODUCT_IMAGE_B] },
        ],
      ],
      blogPostPages: [[{ featured_image_url: CDN_BLOG_IMAGE }]],
    });

    const targets = await enumerateImageFormatBackfillTargets(client, {
      limit: 1,
    });

    expect(targets.productCount).toBe(1);
    expect(targets.blogPostCount).toBe(1);
    expect(targets.urls).toEqual([
      ...productVariantUrls(CDN_PRODUCT_IMAGE_A),
      ...blogVariantUrls(CDN_BLOG_IMAGE),
    ]);
  });

  it('honors an independent blog limit for bounded sample runs', async () => {
    const { calls, client } = createBackfillSupabaseStub({
      blogPostPages: [
        [
          { featured_image_url: CDN_BLOG_IMAGE },
          { featured_image_url: CDN_PRODUCT_IMAGE_A },
        ],
      ],
    });

    const targets = await enumerateImageFormatBackfillTargets(client, {
      blogLimit: 1,
    });

    expect(targets.blogPostCount).toBe(1);
    expect(targets.urls).toEqual(blogVariantUrls(CDN_BLOG_IMAGE));
    expect(calls.find((call) => call.table === 'blog_posts')?.range).toEqual([
      0, 0,
    ]);
  });

  it('throws when the products query fails', async () => {
    const { client } = createBackfillSupabaseStub({
      productsError: { message: 'connection refused' },
    });

    await expect(enumerateImageFormatBackfillTargets(client)).rejects.toThrow(
      /products rows 0-999: connection refused/
    );
  });

  it('throws when the blog_posts query fails', async () => {
    const { client } = createBackfillSupabaseStub({
      blogPostsError: { message: 'permission denied' },
    });

    await expect(enumerateImageFormatBackfillTargets(client)).rejects.toThrow(
      /blog_posts rows 0-999: permission denied/
    );
  });
});
