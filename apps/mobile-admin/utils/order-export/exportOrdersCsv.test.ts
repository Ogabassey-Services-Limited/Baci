import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeOrder } from './order-export.test-helpers';

const {
  mockFileWrite,
  mockLoadOrderExportNativeModules,
  mockIsAvailableAsync,
  mockShareAsync,
} = vi.hoisted(() => ({
  mockFileWrite: vi.fn(),
  mockLoadOrderExportNativeModules: vi.fn(),
  mockIsAvailableAsync: vi.fn(),
  mockShareAsync: vi.fn(),
}));

vi.mock('./loadOrderExportNativeModules', () => ({
  loadOrderExportNativeModules: mockLoadOrderExportNativeModules,
}));

describe('exportOrdersCsv', () => {
  beforeEach(() => {
    mockFileWrite.mockReset();
    mockLoadOrderExportNativeModules.mockReset();
    mockIsAvailableAsync.mockReset();
    mockShareAsync.mockReset();
    mockLoadOrderExportNativeModules.mockResolvedValue({
      FileSystem: {
        File: class MockFile {
          public uri: string;

          public constructor(_root: string, filename: string) {
            this.uri = `file:///documents/${filename}`;
          }

          public write(content: string) {
            mockFileWrite(content);
          }
        },
        Paths: { document: '/documents' },
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

      expect(mockFileWrite).toHaveBeenCalledTimes(1);
      expect(mockFileWrite.mock.calls[0][0]).toContain('BAC-900');
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
});
