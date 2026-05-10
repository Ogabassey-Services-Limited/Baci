import { beforeEach, describe, expect, it, vi } from 'vitest';
import { processStorefrontLayoutJob } from '@/lib/ai-storefront/process-storefront-layout-job';

const mocks = vi.hoisted(() => ({
  generateStorefrontLayoutWithOllama: vi.fn(),
}));

vi.mock('@/lib/ai-storefront/ollama-storefront-client', () => ({
  generateStorefrontLayoutWithOllama: mocks.generateStorefrontLayoutWithOllama,
}));

function createSupabaseMock(options?: {
  pageConfig?: unknown;
  pageError?: { message: string };
  productCount?: number;
  productCountError?: { message: string };
}) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'page_configs') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data:
              options?.pageConfig === undefined
                ? {
                    id: 'page-1',
                    draft_config: {
                      content: [],
                      root: { title: 'Home' },
                      zones: {},
                    },
                    updated_at: '2026-04-28T10:00:00.000Z',
                  }
                : options.pageConfig,
            error: options?.pageError ?? null,
          }),
        };
      }

      if (table === 'products') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            count: options?.productCount ?? 2,
            error: options?.productCountError ?? null,
          })),
          eq: vi.fn().mockReturnThis(),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe('processStorefrontLayoutJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateStorefrontLayoutWithOllama.mockResolvedValue({
      designRationale: 'A conversion-focused electronics homepage.',
      sections: [
        { type: 'Header', props: { id: 'header' } },
        { type: 'Hero', props: { id: 'hero', title: 'Premium phones' } },
        { type: 'ProductGrid', props: { id: 'products', limit: 8 } },
        { type: 'Footer', props: { id: 'footer' } },
      ],
    });
  });

  it('returns completed output without publishing the page config', async () => {
    const output = await processStorefrontLayoutJob({
      supabase: createSupabaseMock() as never,
      jobId: 'job-1',
      merchantId: 'merchant-1',
      input: {
        pageSlug: 'home',
        businessName: 'Bassey Phones',
        businessType: 'electronics',
        brandColors: { primary: '#111827' },
        createdPageConfigUpdatedAt: '2026-04-28T10:00:00.000Z',
      },
    });

    expect(output).toEqual(
      expect.objectContaining({
        generatedConfig: expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({ type: 'Header' }),
            expect.objectContaining({ type: 'ProductGrid' }),
          ]),
          root: { title: 'Home' },
          zones: {},
        }),
        designRationale: 'A conversion-focused electronics homepage.',
        applied: false,
      })
    );
    expect(mocks.generateStorefrontLayoutWithOllama).toHaveBeenCalledWith(
      expect.objectContaining({
        businessName: 'Bassey Phones',
        businessType: 'electronics',
        brandColors: { primary: '#111827' },
        productCount: 2,
      })
    );
  });

  it('fails clearly when the starter page is missing', async () => {
    await expect(
      processStorefrontLayoutJob({
        supabase: createSupabaseMock({ pageConfig: null }) as never,
        jobId: 'job-1',
        merchantId: 'merchant-1',
        input: {
          pageSlug: 'home',
          businessName: 'Bassey Phones',
          businessType: 'electronics',
          brandColors: null,
          createdPageConfigUpdatedAt: null,
        },
      })
    ).rejects.toThrow('Starter page config is missing');
  });

  it('fails clearly when the product count query fails', async () => {
    await expect(
      processStorefrontLayoutJob({
        supabase: createSupabaseMock({
          productCountError: { message: 'database unavailable' },
        }) as never,
        jobId: 'job-1',
        merchantId: 'merchant-1',
        input: {
          pageSlug: 'home',
          businessName: 'Bassey Phones',
          businessType: 'electronics',
          brandColors: null,
          createdPageConfigUpdatedAt: null,
        },
      })
    ).rejects.toThrow('Failed to load active product count');
  });
});
