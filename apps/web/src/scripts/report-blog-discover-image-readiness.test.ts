import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  generateFeaturedImageVariants: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock('@/lib/blog-featured-image-variants', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/blog-featured-image-variants')
  >('@/lib/blog-featured-image-variants');

  return {
    ...actual,
    generateFeaturedImageVariants: mocks.generateFeaturedImageVariants,
  };
});

import {
  buildBlogDiscoverReadinessRows,
  parseReportBlogDiscoverReadinessArgs,
  runReportBlogDiscoverImageReadinessCli,
  toBlogDiscoverReadinessCsv,
  type BlogDiscoverReadinessScanRow,
} from '@/scripts/report-blog-discover-image-readiness';

function createSupabaseMock({
  posts = [],
  merchants = [],
  merchantByIdError = null,
  merchantBySlugError = null,
  merchantInError = null,
  uploadErrorForKey = null,
  updateError = null,
}: {
  posts?: BlogDiscoverReadinessScanRow[];
  merchants?: Array<{ id: string; slug: string }>;
  merchantByIdError?: Error | null;
  merchantBySlugError?: Error | null;
  merchantInError?: Error | null;
  uploadErrorForKey?: string | null;
  updateError?: Error | null;
}) {
  const uploadedPaths: string[] = [];
  const updatedRows: Array<Record<string, unknown>> = [];
  const merchantIn = vi.fn().mockResolvedValue({
    data: merchants,
    error: merchantInError,
  });
  const merchantEq = vi.fn((column: string, value: string) => {
    let row: { id: string; slug: string } | undefined;
    const error = column === 'id' ? merchantByIdError : merchantBySlugError;

    if (column === 'id') {
      row = merchants.find((merchant) => merchant.id === value);
    } else if (column === 'slug') {
      row = merchants.find((merchant) => merchant.slug === value);
    } else {
      throw new Error(`Unexpected merchants.eq column: ${column}`);
    }

    return {
      maybeSingle: vi.fn().mockResolvedValue({
        data: row ?? null,
        error,
      }),
    };
  });
  const merchantSelect = vi.fn(() => ({
    eq: merchantEq,
    in: merchantIn,
  }));
  const postEq = vi.fn(() => postBuilder);
  const postNot = vi.fn(() => postBuilder);
  const postOrder = vi.fn(() => postBuilder);
  const postRange = vi.fn().mockResolvedValue({ data: posts, error: null });
  const postIn = vi.fn().mockResolvedValue({
    data: posts,
    error: null,
  });
  const postUpdateEq = vi.fn().mockResolvedValue({ error: updateError });
  const postUpdate = vi.fn((payload: Record<string, unknown>) => {
    updatedRows.push(payload);
    return { eq: postUpdateEq };
  });

  const postBuilder = {
    eq: postEq,
    not: postNot,
    order: postOrder,
    range: postRange,
    in: postIn,
    update: postUpdate,
  };

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'blog_posts') {
        return {
          select: vi.fn(() => postBuilder),
          update: postUpdate,
        };
      }
      if (table === 'merchants') {
        return {
          select: merchantSelect,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
    storage: {
      from: vi.fn(() => ({
        download: vi.fn().mockResolvedValue({
          data: new Blob([Buffer.from('fake-image')], { type: 'image/jpeg' }),
          error: null,
        }),
        upload: vi.fn((path: string) => {
          uploadedPaths.push(path);
          return Promise.resolve({
            error:
              uploadErrorForKey && path.includes(`/${uploadErrorForKey}.webp`)
                ? new Error('upload failed')
                : null,
          });
        }),
        getPublicUrl: vi.fn((path: string) => ({
          data: {
            publicUrl: `https://cdn.example.com/storage/v1/object/public/media/${path}`,
          },
        })),
      })),
    },
  };

  return {
    supabase,
    uploadedPaths,
    updatedRows,
    merchantEq,
    postEq,
    postNot,
    postOrder,
    postRange,
  };
}

describe('parseReportBlogDiscoverReadinessArgs', () => {
  it('uses dry-run defaults', () => {
    expect(parseReportBlogDiscoverReadinessArgs([])).toEqual({
      ok: true,
      args: {
        format: 'json',
        merchant: null,
        batchSize: 100,
        reprocessManaged: false,
      },
    });
  });

  it('parses explicit format, merchant, batch size, and reprocess flag', () => {
    expect(
      parseReportBlogDiscoverReadinessArgs([
        '--format=csv',
        '--merchant=store-a',
        '--batch-size=50',
        '--reprocess-managed',
      ])
    ).toEqual({
      ok: true,
      args: {
        format: 'csv',
        merchant: 'store-a',
        batchSize: 50,
        reprocessManaged: true,
      },
    });
  });

  it('rejects invalid format', () => {
    const parsed = parseReportBlogDiscoverReadinessArgs(['--format=xml']);
    expect(parsed.ok).toBe(false);
  });
});

describe('buildBlogDiscoverReadinessRows', () => {
  const merchantId = 'merchant-1';
  const otherMerchantId = 'merchant-2';

  const scanRows: BlogDiscoverReadinessScanRow[] = [
    {
      id: 'post-ready',
      merchant_id: merchantId,
      slug: 'ready-post',
      status: 'published',
      featured_image_url:
        'https://cdn.example.com/storage/v1/object/public/media/merchant-1/blog/cover.jpg',
      featured_image_width: 1200,
      featured_image_height: 675,
      featured_image_variants: {
        landscape_16x9:
          'https://cdn.example.com/storage/v1/object/public/media/merchant-1/blog/file-token/landscape_16x9.webp',
      },
    },
    {
      id: 'post-legacy',
      merchant_id: merchantId,
      slug: 'legacy-post',
      status: 'published',
      featured_image_url:
        'https://cdn.example.com/storage/v1/object/public/media/merchant-1/blog/original.jpg',
      featured_image_width: null,
      featured_image_height: null,
      featured_image_variants: {},
    },
    {
      id: 'post-unmanaged',
      merchant_id: otherMerchantId,
      slug: 'unmanaged-post',
      status: 'published',
      featured_image_url: 'https://example.com/external.jpg',
      featured_image_width: 1600,
      featured_image_height: 900,
      featured_image_variants: {},
    },
  ];

  it('returns only non-ready published rows with reason classification', () => {
    const rows = buildBlogDiscoverReadinessRows(
      scanRows,
      new Map([
        [merchantId, 'store-a'],
        [otherMerchantId, 'store-b'],
      ])
    );

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.statusReason).sort()).toEqual([
      'dimensions_too_small',
      'unmanaged_featured_image',
    ]);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        merchantSlug: expect.any(String),
        featuredImageHost: expect.any(String),
        managedPathRecoverable: expect.any(Boolean),
      })
    );
  });

  it('serializes csv output with expected headers', () => {
    const rows = buildBlogDiscoverReadinessRows(
      scanRows,
      new Map([[merchantId, 'store-a']])
    );
    const csv = toBlogDiscoverReadinessCsv(rows);

    expect(csv).toContain('merchant_id,merchant_slug,post_id,post_slug');
    expect(csv).toContain('legacy-post');
  });
});

describe('runReportBlogDiscoverImageReadinessCli', () => {
  const merchantId = 'merchant-1';
  const managedLegacyRow: BlogDiscoverReadinessScanRow = {
    id: 'post-1',
    merchant_id: merchantId,
    slug: 'legacy-post',
    status: 'published',
    featured_image_url:
      'https://cdn.example.com/storage/v1/object/public/media/merchant-1/blog/original.jpg',
    featured_image_width: null,
    featured_image_height: null,
    featured_image_variants: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateFeaturedImageVariants.mockResolvedValue({
      source: { width: 1400, height: 900, totalPixels: 1_260_000 },
      variants: {
        landscape_16x9: {
          key: 'landscape_16x9',
          width: 1200,
          height: 675,
          contentType: 'image/webp',
          buffer: Buffer.from('variant-16x9'),
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies merchant filter by merchant_id and returns success', async () => {
    const { supabase, postEq } = createSupabaseMock({
      posts: [managedLegacyRow],
      merchants: [{ id: merchantId, slug: 'store-a' }],
    });
    mocks.createServiceClient.mockReturnValue(supabase);

    const exitCode = await runReportBlogDiscoverImageReadinessCli([
      '--merchant=merchant-1',
      '--batch-size=25',
    ]);

    expect(exitCode).toBe(0);
    expect(postEq).toHaveBeenCalledWith('status', 'published');
    expect(postEq).toHaveBeenCalledWith('merchant_id', merchantId);
  });

  it('logs merchant resolution failures before returning not found', async () => {
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { supabase } = createSupabaseMock({
      merchantByIdError: new Error('merchant lookup failed'),
    });
    mocks.createServiceClient.mockReturnValue(supabase);

    try {
      const exitCode = await runReportBlogDiscoverImageReadinessCli([
        '--merchant=merchant-1',
      ]);

      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        'maybeResolveMerchantId failed resolving by id',
        expect.objectContaining({
          merchantFilter: 'merchant-1',
          error: 'merchant lookup failed',
        })
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('logs merchant lookup failures for report row enrichment', async () => {
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { supabase } = createSupabaseMock({
      posts: [managedLegacyRow],
      merchantInError: new Error('merchant list failed'),
    });
    mocks.createServiceClient.mockReturnValue(supabase);

    try {
      const exitCode = await runReportBlogDiscoverImageReadinessCli([]);

      expect(exitCode).toBe(0);
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to load merchants for report rows',
        expect.objectContaining({
          merchantIds: [merchantId],
          error: 'merchant list failed',
        })
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('reprocesses only managed rows and does not upload for unmanaged rows', async () => {
    const { supabase, uploadedPaths, updatedRows } = createSupabaseMock({
      posts: [
        managedLegacyRow,
        {
          ...managedLegacyRow,
          id: 'post-2',
          slug: 'external-post',
          featured_image_url: 'https://example.com/external.jpg',
        },
      ],
      merchants: [{ id: merchantId, slug: 'store-a' }],
    });
    mocks.createServiceClient.mockReturnValue(supabase);

    const exitCode = await runReportBlogDiscoverImageReadinessCli([
      '--reprocess-managed',
    ]);

    expect(exitCode).toBe(0);
    expect(uploadedPaths.length).toBeGreaterThan(0);
    expect(updatedRows).toHaveLength(1);
    expect(updatedRows[0]?.featured_image_variants).toEqual({
      landscape_16x9:
        'https://cdn.ogabassey.com/media/merchant-1/blog/original/landscape_16x9.webp',
    });
  });

  it('logs partial upload state when a managed row variant upload fails', async () => {
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mocks.generateFeaturedImageVariants.mockResolvedValueOnce({
      source: { width: 1400, height: 900, totalPixels: 1_260_000 },
      variants: {
        landscape_16x9: {
          key: 'landscape_16x9',
          width: 1200,
          height: 675,
          contentType: 'image/webp',
          buffer: Buffer.from('variant-16x9'),
        },
        square_1x1: {
          key: 'square_1x1',
          width: 1200,
          height: 1200,
          contentType: 'image/webp',
          buffer: Buffer.from('variant-1x1'),
        },
      },
    });
    const { supabase, updatedRows } = createSupabaseMock({
      posts: [managedLegacyRow],
      merchants: [{ id: merchantId, slug: 'store-a' }],
      uploadErrorForKey: 'square_1x1',
    });
    mocks.createServiceClient.mockReturnValue(supabase);

    try {
      const exitCode = await runReportBlogDiscoverImageReadinessCli([
        '--reprocess-managed',
      ]);

      expect(exitCode).toBe(0);
      expect(updatedRows).toHaveLength(0);
      expect(errorSpy).toHaveBeenCalledWith(
        'reprocessManagedRows variant upload failed',
        expect.objectContaining({
          postId: 'post-1',
          variantKey: 'square_1x1',
          uploadedVariants: ['landscape_16x9'],
          error: 'upload failed',
        })
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
