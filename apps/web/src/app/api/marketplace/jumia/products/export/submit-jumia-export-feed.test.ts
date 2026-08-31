import { beforeEach, describe, expect, it, vi } from 'vitest';
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
vi.mock('./mark-ambiguous-jumia-export', () => ({
  markAmbiguousJumiaExport: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

describe('submitJumiaExportFeed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('releases the reservation after a definitive Jumia rejection', async () => {
    const { createProduct } = await import('@/lib/jumia/feeds');
    const { releaseJumiaExportReservation, finalizeJumiaExportReservation } =
      await import('./export-product-reservation');
    vi.mocked(createProduct).mockRejectedValue(
      new JumiaApiError(
        400,
        '{"listing":"private","message":"invalid product"}'
      )
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
      status: 400,
      body: {
        error:
          'Jumia product export was rejected by the marketplace. Review the product details and try again.',
      },
    });
    expect(releaseJumiaExportReservation).toHaveBeenCalled();
    expect(finalizeJumiaExportReservation).not.toHaveBeenCalled();

    const { logger } = await import('@/lib/logger');
    expect(logger.error).toHaveBeenCalledWith({
      message: 'Jumia createProduct feed failed',
      status: 400,
    });
    expect(logger.error).not.toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('private') })
    );
  });

  it('retains the reservation when Jumia may have accepted the create request', async () => {
    const { createProduct } = await import('@/lib/jumia/feeds');
    const { releaseJumiaExportReservation, finalizeJumiaExportReservation } =
      await import('./export-product-reservation');
    const { markAmbiguousJumiaExport } = await import(
      './mark-ambiguous-jumia-export'
    );
    vi.mocked(createProduct).mockRejectedValue(
      new JumiaApiError(502, 'upstream response lost')
    );
    vi.mocked(markAmbiguousJumiaExport).mockResolvedValue(true);

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
          'Jumia product submission outcome is unknown. Retry is blocked while Baci reconciles the reserved SKU to avoid a duplicate listing.',
      },
    });
    expect(releaseJumiaExportReservation).not.toHaveBeenCalled();
    expect(finalizeJumiaExportReservation).not.toHaveBeenCalled();
    expect(markAmbiguousJumiaExport).toHaveBeenCalled();
  });

  it('marks raw transport failures as ambiguous before returning', async () => {
    const { createProduct } = await import('@/lib/jumia/feeds');
    const { releaseJumiaExportReservation, finalizeJumiaExportReservation } =
      await import('./export-product-reservation');
    const { markAmbiguousJumiaExport } = await import(
      './mark-ambiguous-jumia-export'
    );
    vi.mocked(createProduct).mockRejectedValue(
      new TypeError('fetch failed: connection reset')
    );
    vi.mocked(markAmbiguousJumiaExport).mockResolvedValue(true);

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
          'Jumia product submission outcome is unknown. Retry is blocked while Baci reconciles the reserved SKU to avoid a duplicate listing.',
      },
    });
    expect(markAmbiguousJumiaExport).toHaveBeenCalled();
    expect(releaseJumiaExportReservation).not.toHaveBeenCalled();
    expect(finalizeJumiaExportReservation).not.toHaveBeenCalled();
  });
});
