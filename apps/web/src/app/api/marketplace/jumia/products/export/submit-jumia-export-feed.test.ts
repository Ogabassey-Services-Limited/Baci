import { describe, expect, it, vi } from 'vitest';
import { JumiaApiError } from '@/lib/jumia/helpers';
import { submitJumiaExportFeed } from './submit-jumia-export-feed';

vi.mock('@/lib/jumia/feeds', () => ({
  createProduct: vi.fn(),
}));
vi.mock('./export-product-reservation', () => ({
  finalizeJumiaExportReservation: vi.fn(),
  markJumiaExportReservationForReconciliation: vi.fn(),
  releaseJumiaExportReservation: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

describe('submitJumiaExportFeed', () => {
  it('releases the reservation and returns the Jumia API error when createProduct fails', async () => {
    const { createProduct } = await import('@/lib/jumia/feeds');
    const { releaseJumiaExportReservation, finalizeJumiaExportReservation } =
      await import('./export-product-reservation');
    vi.mocked(createProduct).mockRejectedValue(
      new JumiaApiError(502, 'upstream failed')
    );
    vi.mocked(releaseJumiaExportReservation).mockResolvedValue(true);

    const result = await submitJumiaExportFeed({
      jumia: {} as never,
      supabase: {} as never,
      merchantId: 'merchant-1',
      productId: 'product-1',
      shopId: 'shop-1',
      marketplaceKey: 'Jumia Nigeria',
      exportName: 'Phone',
      brand: { code: 1, name: 'Generic' },
      category: { code: 2 },
      exportVariations: [{ sellerSku: 'SKU-1', price: 100, currency: 'NGN' }],
    });

    expect(result).toEqual({
      ok: false,
      status: 502,
      body: {
        error:
          'Jumia product export failed: Jumia API Error (502): upstream failed',
      },
    });
    expect(releaseJumiaExportReservation).toHaveBeenCalled();
    expect(finalizeJumiaExportReservation).not.toHaveBeenCalled();
  });
});
