import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateInitialTemplate: vi.fn(),
}));

vi.mock('@/lib/initial-template-generator', () => ({
  generateInitialTemplate: mocks.generateInitialTemplate,
}));

import { runDeferredMerchantProvisioning } from './run-deferred-merchant-provisioning';

describe('runDeferredMerchantProvisioning', () => {
  const upsert = vi.fn();
  const supabase = {
    from: vi.fn(() => ({ upsert })),
  } as unknown as SupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generateInitialTemplate.mockResolvedValue({
      content: [
        { type: 'Header', props: { storeName: 'Analytical Engines' } },
        {
          type: 'HeroCarousel',
          props: { slides: [{ title: 'Welcome to Analytical Engines' }] },
        },
      ],
    });
    upsert.mockResolvedValue({ error: null });
  });

  it('normalizes the business name once and idempotently publishes home through the caller client', async () => {
    await runDeferredMerchantProvisioning({
      supabase,
      merchantId: 'merchant-1',
      merchantSlug: 'analytical-engines',
      businessName: '  Analytical   Engines  ',
      businessType: 'technology',
      brandColors: {
        primary: '#111',
        background: '#fff',
        accent: '#f59e0b',
      },
    });

    expect(mocks.generateInitialTemplate).toHaveBeenCalledWith({
      businessName: 'Analytical Engines',
      businessType: 'technology',
      brandColors: {
        primary: '#111',
        background: '#fff',
        accent: '#f59e0b',
      },
      merchant: { id: 'merchant-1', slug: 'analytical-engines' },
    });
    expect(supabase.from).toHaveBeenCalledWith('page_configs');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: 'merchant-1',
        page_slug: 'home',
        page_name: 'Home',
        is_published: true,
        draft_config: expect.any(Object),
        published_config: expect.any(Object),
      }),
      { onConflict: 'merchant_id,page_slug' }
    );
  });

  it('keeps the coming-soon fallback untouched when template generation fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.generateInitialTemplate.mockRejectedValue(new Error('provider down'));

    await expect(
      runDeferredMerchantProvisioning({
        supabase,
        merchantId: 'merchant-1',
        merchantSlug: 'analytical-engines',
        businessName: 'Analytical Engines',
        businessType: 'technology',
        brandColors: null,
      })
    ).resolves.toBeUndefined();

    expect(upsert).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      'mobile-merchant-provisioning %s',
      'deferred_failure',
      expect.stringContaining('"stage":"template_generation"')
    );
    errorSpy.mockRestore();
  });

  it('logs a caller-scoped page upsert failure without throwing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    upsert.mockResolvedValue({ error: { code: '42501' } });

    await expect(
      runDeferredMerchantProvisioning({
        supabase,
        merchantId: 'merchant-1',
        merchantSlug: 'analytical-engines',
        businessName: 'Analytical Engines',
        businessType: 'technology',
        brandColors: null,
      })
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      'mobile-merchant-provisioning %s',
      'deferred_failure',
      expect.stringContaining('"pgCode":"42501"')
    );
    errorSpy.mockRestore();
  });
});
