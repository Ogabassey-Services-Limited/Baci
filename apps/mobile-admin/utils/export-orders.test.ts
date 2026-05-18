import { describe, expect, it, vi } from 'vitest';

const { mockBuildOrdersCsv, mockExportOrderReportPdf, mockExportOrdersCsv } =
  vi.hoisted(() => ({
    mockBuildOrdersCsv: vi.fn(),
    mockExportOrderReportPdf: vi.fn(),
    mockExportOrdersCsv: vi.fn(),
  }));

vi.mock('./order-export/buildOrdersCsv', () => ({
  buildOrdersCsv: mockBuildOrdersCsv,
}));

vi.mock('./order-export/exportOrderReportPdf', () => ({
  exportOrderReportPdf: mockExportOrderReportPdf,
}));

vi.mock('./order-export/exportOrdersCsv', () => ({
  exportOrdersCsv: mockExportOrdersCsv,
}));

describe('orderExportTools', () => {
  it('re-exports the split order export helpers through one object', async () => {
    const { orderExportTools } = await import('./export-orders');

    expect(orderExportTools.generateOrdersCSV).toBe(mockBuildOrdersCsv);
    expect(orderExportTools.exportOrdersRPC).toBe(mockExportOrdersCsv);
    expect(orderExportTools.exportOrderReportPDF).toBe(
      mockExportOrderReportPdf
    );
  });
});
