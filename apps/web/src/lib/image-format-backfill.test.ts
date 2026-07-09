import { describe, expect, it, vi } from 'vitest';
import { runImageFormatBackfill } from '@/lib/image-format-backfill';
import type { ImageFormatBackfillSupabaseClient } from '@/lib/image-format-backfill-enumeration';
import {
  buildOgabasseyPrewarmTransformUrls,
  PREWARM_ACCEPT_HEADER,
} from '@/lib/ogabassey-image-prewarm';
import { BLOG_IMAGE_WIDTH_QUALITY_PAIRS } from '@/lib/ogabassey-image-prewarm-pairs';

const CDN_PRODUCT_IMAGE =
  'https://cdn.ogabassey.com/core-assets/products/phone.avif';
const CDN_BLOG_IMAGE = 'https://cdn.ogabassey.com/core-assets/blog/hero.avif';

const PRODUCT_VARIANT_URLS = Array.from(
  new Set(
    buildOgabasseyPrewarmTransformUrls(CDN_PRODUCT_IMAGE, undefined, {
      format: 'auto',
    })
  )
);
const BLOG_VARIANT_URLS = Array.from(
  new Set(
    buildOgabasseyPrewarmTransformUrls(
      CDN_BLOG_IMAGE,
      BLOG_IMAGE_WIDTH_QUALITY_PAIRS,
      { format: 'auto' }
    )
  )
);

const noopLog = () => undefined;

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
  range: [from: number, to: number];
}

// Duplicated in image-format-backfill-enumeration.test.ts: the Stop-hook
// quality gate requires a colocated test for every non-test source file, so
// a shared *.test-utils.ts module is not an option here.
function createBackfillSupabaseStub(config: BackfillSupabaseStubConfig = {}): {
  calls: RecordedRangeCall[];
  client: ImageFormatBackfillSupabaseClient;
} {
  const calls: RecordedRangeCall[] = [];

  const client: ImageFormatBackfillSupabaseClient = {
    from(table: string) {
      return {
        select() {
          const builder = {
            eq() {
              return builder;
            },
            order() {
              return builder;
            },
            range(from: number, to: number) {
              calls.push({ table, range: [from, to] });
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

function headResponse(contentType: string | null, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(
      contentType ? { 'content-type': contentType } : undefined
    ),
  } as Response;
}

/**
 * Fetch mock that serves each URL a scripted sequence of outcomes (the last
 * outcome repeats), with an AVIF response as the default for unscripted URLs.
 */
function createFetchMock(plan: Record<string, Array<Response | Error>> = {}) {
  const callCounts = new Map<string, number>();
  return vi.fn((input: string | URL | Request): Promise<Response> => {
    const url = String(input);
    const callIndex = callCounts.get(url) ?? 0;
    callCounts.set(url, callIndex + 1);
    const outcomes = plan[url];
    if (!outcomes || outcomes.length === 0) {
      return Promise.resolve(headResponse('image/avif'));
    }
    const outcome = outcomes[Math.min(callIndex, outcomes.length - 1)];
    if (outcome instanceof Error) {
      return Promise.reject(outcome);
    }
    return Promise.resolve(outcome);
  });
}

function createPurgeMock() {
  return vi.fn((_urls: string[]) => Promise.resolve());
}

function createOneProductStub() {
  return createBackfillSupabaseStub({
    productPages: [[{ id: 'p1', images: [CDN_PRODUCT_IMAGE] }]],
  });
}

describe('runImageFormatBackfill', () => {
  describe('dry run', () => {
    it('returns enumeration counts and sample URLs without any HTTP request or purge', async () => {
      const { client } = createBackfillSupabaseStub({
        productPages: [
          [
            { id: 'p1', images: [CDN_PRODUCT_IMAGE] },
            { id: 'p2', images: null },
          ],
        ],
        blogPostPages: [[{ featured_image_url: CDN_BLOG_IMAGE }]],
      });
      const fetchImpl = createFetchMock();
      const purgeImpl = createPurgeMock();

      const summary = await runImageFormatBackfill({
        supabase: client,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        purgeImpl,
        dryRun: true,
        log: noopLog,
      });

      expect(fetchImpl).not.toHaveBeenCalled();
      expect(purgeImpl).not.toHaveBeenCalled();
      const allUrls = [...PRODUCT_VARIANT_URLS, ...BLOG_VARIANT_URLS];
      expect(summary).toEqual({
        products: 2,
        blogPosts: 1,
        urls: allUrls.length,
        checked: 0,
        healthy: 0,
        poisoned: 0,
        purgeRequested: 0,
        rewarmed: 0,
        residualNonAvif: 0,
        errored: 0,
        sampleUrls: allUrls.slice(0, 10),
        dryRun: true,
      });
    });
  });

  describe('check phase', () => {
    it('HEADs every variant with the AVIF-first Accept header', async () => {
      const { client } = createOneProductStub();
      const fetchImpl = createFetchMock();

      await runImageFormatBackfill({
        supabase: client,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        purgeImpl: createPurgeMock(),
        log: noopLog,
      });

      expect(fetchImpl).toHaveBeenCalledTimes(PRODUCT_VARIANT_URLS.length);
      for (const [url, init] of fetchImpl.mock.calls as unknown as [
        string,
        RequestInit,
      ][]) {
        expect(PRODUCT_VARIANT_URLS).toContain(url);
        expect(init.method).toBe('HEAD');
        expect((init.headers as Record<string, string>).Accept).toBe(
          PREWARM_ACCEPT_HEADER
        );
      }
    });

    it('classifies AVIF variants healthy and purges only the non-AVIF image variants', async () => {
      const { client } = createOneProductStub();
      const [poisonedA, poisonedB] = PRODUCT_VARIANT_URLS;
      const fetchImpl = createFetchMock({
        [poisonedA]: [headResponse('image/webp'), headResponse('image/avif')],
        [poisonedB]: [
          headResponse('image/jpeg; charset=utf-8'),
          headResponse('image/avif'),
        ],
      });
      const purgeImpl = createPurgeMock();

      const summary = await runImageFormatBackfill({
        supabase: client,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        purgeImpl,
        log: noopLog,
      });

      expect(purgeImpl).toHaveBeenCalledTimes(1);
      expect(purgeImpl.mock.calls[0]?.[0]).toEqual([poisonedA, poisonedB]);
      expect(summary).toMatchObject({
        checked: PRODUCT_VARIANT_URLS.length,
        healthy: PRODUCT_VARIANT_URLS.length - 2,
        poisoned: 2,
        purgeRequested: 2,
        rewarmed: 2,
        residualNonAvif: 0,
        errored: 0,
        dryRun: false,
      });
    });

    it('counts failing variants as errored and never purges on the strength of an error', async () => {
      const { client } = createOneProductStub();
      const [notFoundUrl, networkErrorUrl, nonImageUrl] = PRODUCT_VARIANT_URLS;
      const fetchImpl = createFetchMock({
        [notFoundUrl]: [headResponse('text/html', 404)],
        [networkErrorUrl]: [new Error('socket hang up')],
        [nonImageUrl]: [headResponse('text/html')],
      });
      const purgeImpl = createPurgeMock();

      const summary = await runImageFormatBackfill({
        supabase: client,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        purgeImpl,
        log: noopLog,
      });

      expect(purgeImpl).not.toHaveBeenCalled();
      expect(summary).toMatchObject({
        checked: PRODUCT_VARIANT_URLS.length,
        healthy: PRODUCT_VARIANT_URLS.length - 3,
        poisoned: 0,
        purgeRequested: 0,
        rewarmed: 0,
        errored: 3,
      });
    });
  });

  describe('re-warm phase', () => {
    it('re-HEADs purged variants once, reporting residual non-AVIF without purging again', async () => {
      const { client } = createOneProductStub();
      const [rewarmedUrl, residualUrl, erroredUrl] = PRODUCT_VARIANT_URLS;
      const fetchImpl = createFetchMock({
        [rewarmedUrl]: [headResponse('image/webp'), headResponse('image/avif')],
        [residualUrl]: [headResponse('image/webp'), headResponse('image/webp')],
        [erroredUrl]: [headResponse('image/webp'), headResponse(null, 503)],
      });
      const purgeImpl = createPurgeMock();

      const summary = await runImageFormatBackfill({
        supabase: client,
        fetchImpl: fetchImpl as unknown as typeof fetch,
        purgeImpl,
        log: noopLog,
      });

      expect(purgeImpl).toHaveBeenCalledTimes(1);
      expect(purgeImpl.mock.calls[0]?.[0]).toEqual([
        rewarmedUrl,
        residualUrl,
        erroredUrl,
      ]);
      // Each poisoned URL is fetched exactly twice: check + re-warm.
      expect(fetchImpl).toHaveBeenCalledTimes(PRODUCT_VARIANT_URLS.length + 3);
      expect(summary).toMatchObject({
        poisoned: 3,
        purgeRequested: 3,
        rewarmed: 1,
        residualNonAvif: 1,
        errored: 1,
      });
    });
  });

  describe('enumeration wiring', () => {
    it('honors the product limit for the sample rung', async () => {
      const { client } = createBackfillSupabaseStub({
        productPages: [
          [
            { id: 'p1', images: [CDN_PRODUCT_IMAGE] },
            { id: 'p2', images: [CDN_BLOG_IMAGE] },
          ],
        ],
      });

      const summary = await runImageFormatBackfill({
        supabase: client,
        fetchImpl: createFetchMock() as unknown as typeof fetch,
        purgeImpl: createPurgeMock(),
        dryRun: true,
        limit: 1,
        log: noopLog,
      });

      expect(summary.products).toBe(1);
      expect(summary.sampleUrls).toEqual(PRODUCT_VARIANT_URLS.slice(0, 10));
    });

    it('paginates two pages of 1000 products', async () => {
      const fullPage = Array.from({ length: 1000 }, (_, index) => ({
        id: `p${index}`,
        images: null,
      }));
      const { calls, client } = createBackfillSupabaseStub({
        productPages: [
          fullPage,
          [{ id: 'p1000', images: [CDN_PRODUCT_IMAGE] }],
        ],
      });

      const summary = await runImageFormatBackfill({
        supabase: client,
        fetchImpl: createFetchMock() as unknown as typeof fetch,
        purgeImpl: createPurgeMock(),
        dryRun: true,
        log: noopLog,
      });

      expect(summary.products).toBe(1001);
      expect(summary.urls).toBe(PRODUCT_VARIANT_URLS.length);
      expect(
        calls
          .filter((call) => call.table === 'products')
          .map((call) => call.range)
      ).toEqual([
        [0, 999],
        [1000, 1999],
      ]);
    });

    it('throws on a products query error before checking or purging anything', async () => {
      const { client } = createBackfillSupabaseStub({
        productsError: { message: 'connection refused' },
      });
      const fetchImpl = createFetchMock();
      const purgeImpl = createPurgeMock();

      await expect(
        runImageFormatBackfill({
          supabase: client,
          fetchImpl: fetchImpl as unknown as typeof fetch,
          purgeImpl,
          log: noopLog,
        })
      ).rejects.toThrow(/products rows 0-999: connection refused/);

      expect(fetchImpl).not.toHaveBeenCalled();
      expect(purgeImpl).not.toHaveBeenCalled();
    });

    it('throws on a blog_posts query error before checking or purging anything', async () => {
      const { client } = createBackfillSupabaseStub({
        productPages: [[{ id: 'p1', images: [CDN_PRODUCT_IMAGE] }]],
        blogPostsError: { message: 'permission denied' },
      });
      const fetchImpl = createFetchMock();
      const purgeImpl = createPurgeMock();

      await expect(
        runImageFormatBackfill({
          supabase: client,
          fetchImpl: fetchImpl as unknown as typeof fetch,
          purgeImpl,
          log: noopLog,
        })
      ).rejects.toThrow(/blog_posts rows 0-999: permission denied/);

      expect(fetchImpl).not.toHaveBeenCalled();
      expect(purgeImpl).not.toHaveBeenCalled();
    });
  });
});
