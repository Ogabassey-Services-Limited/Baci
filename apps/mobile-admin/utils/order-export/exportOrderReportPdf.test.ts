import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeOrder,
  makeOrderItemQueryData,
} from './order-export.test-helpers';

const {
  mockIn,
  mockLoadOrderExportNativeModules,
  mockPrintToFileAsync,
  mockReturns,
  mockShareAsync,
} = vi.hoisted(() => ({
  mockIn: vi.fn(),
  mockLoadOrderExportNativeModules: vi.fn(),
  mockPrintToFileAsync: vi.fn(),
  mockReturns: vi.fn(),
  mockShareAsync: vi.fn(),
}));

vi.mock('./loadOrderExportNativeModules', () => ({
  loadOrderExportNativeModules: mockLoadOrderExportNativeModules,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        in: mockIn,
      })),
    })),
  },
}));

describe('exportOrderReportPdf', () => {
  beforeEach(() => {
    mockLoadOrderExportNativeModules.mockReset();
    mockReturns.mockReset();
    mockIn.mockReset();
    mockPrintToFileAsync.mockReset();
    mockShareAsync.mockReset();
    mockLoadOrderExportNativeModules.mockResolvedValue({
      FileSystem: null,
      Print: { printToFileAsync: mockPrintToFileAsync },
      Sharing: { shareAsync: mockShareAsync },
    });
    mockIn.mockReturnValue({
      returns: mockReturns,
    });
    mockReturns.mockResolvedValue({
      data: [
        makeOrderItemQueryData({
          products: { name: 'Laptop Bag' },
          quantity: 3,
        }),
      ],
      error: null,
    });
    mockPrintToFileAsync.mockResolvedValue({ uri: 'file:///report.pdf' });
    mockShareAsync.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    'builds the report HTML, prints it, and shares the PDF',
    async () => {
      const { exportOrderReportPdf } = await import('./exportOrderReportPdf');

      await exportOrderReportPdf(
        [makeOrder({ customer_name: 'Grace Hopper', total: 22000 })],
        'May 1 - May 10, 2026',
        'Baci HQ',
        'https://cdn.example.com/logo.png'
      );

      expect(mockPrintToFileAsync).toHaveBeenCalledTimes(1);
      expect(mockPrintToFileAsync.mock.calls[0][0].html).toContain('Baci HQ');
      expect(mockPrintToFileAsync.mock.calls[0][0].html).toContain(
        'May 1 - May 10, 2026'
      );
      expect(mockPrintToFileAsync.mock.calls[0][0].html).toContain(
        'Laptop Bag'
      );
      expect(mockShareAsync).toHaveBeenCalledWith(
        'file:///report.pdf',
        expect.objectContaining({
          UTI: 'public.pdf',
          mimeType: 'application/pdf',
        })
      );
    },
    15000
  );

  it(
    'continues when item lookups fail and still shares the PDF',
    async () => {
      mockReturns.mockResolvedValue({
        data: null,
        error: { message: 'query failed' },
      });
      const { exportOrderReportPdf } = await import('./exportOrderReportPdf');

      await exportOrderReportPdf([makeOrder()], 'Today', 'Baci HQ');

      expect(mockPrintToFileAsync).toHaveBeenCalledTimes(1);
      expect(mockShareAsync).toHaveBeenCalledTimes(1);
    },
    15000
  );

  it(
    'loads order items in chunks so large reports do not build oversized query URLs',
    async () => {
      mockReturns
        .mockResolvedValueOnce({
          data: [makeOrderItemQueryData({ product_id: 'product-1' })],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [makeOrderItemQueryData({ product_id: 'product-51' })],
          error: null,
        })
        .mockResolvedValueOnce({
          data: [
            makeOrderItemQueryData({
              price: 5000,
              product_id: 'product-101',
              products: { name: 'Product 101' },
              quantity: 99,
            }),
          ],
          error: null,
        });
      const orders = Array.from({ length: 101 }, (_, index) =>
        makeOrder({ id: `order-${index + 1}` })
      );
      const { exportOrderReportPdf } = await import('./exportOrderReportPdf');

      await exportOrderReportPdf(orders, 'May 2026', 'Baci HQ');

      expect(mockIn).toHaveBeenCalledTimes(3);
      expect(mockIn.mock.calls[0][1]).toHaveLength(50);
      expect(mockIn.mock.calls[1][1]).toHaveLength(50);
      expect(mockIn.mock.calls[2][1]).toEqual(['order-101']);
      expect(mockPrintToFileAsync.mock.calls[0][0].html).toContain(
        'Product 101'
      );
    },
    15000
  );

  it('throws when the sharing module is unavailable', async () => {
    mockLoadOrderExportNativeModules.mockResolvedValue({
      FileSystem: null,
      Print: { printToFileAsync: mockPrintToFileAsync },
      Sharing: null,
    });
    const { exportOrderReportPdf } = await import('./exportOrderReportPdf');

    await expect(
      exportOrderReportPdf([makeOrder()], 'Today', 'Baci HQ')
    ).rejects.toThrow('Export modules not available');
  });
});
