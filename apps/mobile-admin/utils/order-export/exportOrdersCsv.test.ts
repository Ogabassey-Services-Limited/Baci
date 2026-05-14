import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeOrder } from './order-export.test-helpers';

const {
  mockLoadOrderExportNativeModules,
  mockIsAvailableAsync,
  mockShareAsync,
  mockWriteAsStringAsync,
} = vi.hoisted(() => ({
  mockLoadOrderExportNativeModules: vi.fn(),
  mockIsAvailableAsync: vi.fn(),
  mockShareAsync: vi.fn(),
  mockWriteAsStringAsync: vi.fn(),
}));

vi.mock('./loadOrderExportNativeModules', () => ({
  loadOrderExportNativeModules: mockLoadOrderExportNativeModules,
}));

describe('exportOrdersCsv', () => {
  beforeEach(() => {
    mockLoadOrderExportNativeModules.mockReset();
    mockIsAvailableAsync.mockReset();
    mockShareAsync.mockReset();
    mockWriteAsStringAsync.mockReset();
    mockLoadOrderExportNativeModules.mockResolvedValue({
      FileSystem: {
        documentDirectory: 'file:///documents/',
        writeAsStringAsync: mockWriteAsStringAsync,
      },
      Print: null,
      Sharing: {
        isAvailableAsync: mockIsAvailableAsync,
        shareAsync: mockShareAsync,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    'writes the CSV to a file and shares it when sharing is available',
    async () => {
      mockIsAvailableAsync.mockResolvedValue(true);
      const { exportOrdersCsv } = await import('./exportOrdersCsv');

      await exportOrdersCsv([makeOrder({ order_number: 'BAC-900' })]);

      expect(mockWriteAsStringAsync).toHaveBeenCalledTimes(1);
      expect(mockWriteAsStringAsync.mock.calls[0][0]).toMatch(
        /^file:\/\/\/documents\/orders_report_\d{8}_\d{6}\.csv$/
      );
      expect(mockWriteAsStringAsync.mock.calls[0][1]).toContain('BAC-900');
      expect(mockShareAsync).toHaveBeenCalledTimes(1);
      expect(mockShareAsync.mock.calls[0][0]).toMatch(
        /^file:\/\/\/documents\/orders_report_\d{8}_\d{6}\.csv$/
      );
      expect(mockShareAsync.mock.calls[0][1]).toEqual(
        expect.objectContaining({
          dialogTitle: 'Export Orders Report',
          mimeType: 'text/csv',
        })
      );
    },
    15000
  );

  it('throws when sharing is not available', async () => {
    mockIsAvailableAsync.mockResolvedValue(false);
    const { exportOrdersCsv } = await import('./exportOrdersCsv');

    await expect(exportOrdersCsv([makeOrder()])).rejects.toThrow(
      'Sharing is not available on this device'
    );
  });

  it('throws when the sharing module is unavailable', async () => {
    mockLoadOrderExportNativeModules.mockResolvedValue({
      FileSystem: {
        documentDirectory: 'file:///documents/',
        writeAsStringAsync: mockWriteAsStringAsync,
      },
      Print: null,
      Sharing: null,
    });
    const { exportOrdersCsv } = await import('./exportOrdersCsv');

    await expect(exportOrdersCsv([makeOrder()])).rejects.toThrow(
      'Export modules not available'
    );
  });
});
