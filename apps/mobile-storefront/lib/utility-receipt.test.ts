import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  buildUtilityReceiptHtml,
  shareUtilityReceipt,
} from '@/lib/utility-receipt';

const mockShare = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const mockPrintToFileAsync =
  jest.fn<(...args: unknown[]) => Promise<{ uri: string }>>();
const mockIsAvailableAsync = jest.fn<() => Promise<boolean>>();
const mockShareAsync = jest.fn<(...args: unknown[]) => Promise<void>>();
const mockDeleteAsync = jest.fn<(...args: unknown[]) => Promise<void>>();

jest.mock('react-native', () => ({
  Share: {
    share: (...args: unknown[]) => mockShare(...args),
  },
}));

jest.mock('expo-print', () => ({
  printToFileAsync: (...args: unknown[]) => mockPrintToFileAsync(...args),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: () => mockIsAvailableAsync(),
  shareAsync: (...args: unknown[]) => mockShareAsync(...args),
}));

jest.mock('expo-file-system', () => ({
  deleteAsync: (...args: unknown[]) => mockDeleteAsync(...args),
}));

describe('utility-receipt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrintToFileAsync.mockResolvedValue({ uri: 'file:///tmp/receipt.pdf' });
    mockIsAvailableAsync.mockResolvedValue(true);
    mockShare.mockResolvedValue({ action: 'sharedAction' });
    mockShareAsync.mockResolvedValue(undefined);
    mockDeleteAsync.mockResolvedValue(undefined);
  });

  it('builds an escaped receipt with the electricity token', () => {
    const html = buildUtilityReceiptHtml({
      amount: 1000,
      customerIdentifier: '43901766923',
      reference: 'ref-123',
      status: 'successful',
      type: 'power',
      voucherPin: '<token-123>',
    });

    expect(html).toContain('Electricity Receipt');
    expect(html).toContain('₦1,000');
    expect(html).toContain('43901766923');
    expect(html).toContain('&lt;token-123&gt;');
    expect(html).not.toContain('<token-123>');
  });

  it('includes zero amount in receipt HTML', () => {
    const html = buildUtilityReceiptHtml({
      amount: 0,
      customerIdentifier: '08012345678',
      reference: 'ref-123',
      status: 'successful',
      type: 'airtime',
    });

    expect(html).toContain('Amount');
    expect(html).toContain('₦0');
  });

  it('falls back to native share with zero amount when file sharing is unavailable', async () => {
    mockIsAvailableAsync.mockResolvedValue(false);

    await shareUtilityReceipt({
      amount: 0,
      customerIdentifier: '08012345678',
      reference: 'ref-123',
      status: 'successful',
      type: 'airtime',
    });

    expect(mockIsAvailableAsync).toHaveBeenCalledTimes(1);
    expect(mockShare).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Amount: ₦0'),
      })
    );
    expect(mockShareAsync).not.toHaveBeenCalled();
    expect(mockDeleteAsync).not.toHaveBeenCalled();
  });

  it('falls back to native share when PDF generation fails', async () => {
    mockPrintToFileAsync.mockRejectedValue(new Error('print failed'));

    await shareUtilityReceipt({
      amount: 1000,
      customerIdentifier: '08012345678',
      reference: 'ref-123',
      status: 'successful',
      type: 'airtime',
    });

    expect(mockShare).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Reference: ref-123'),
      })
    );
    expect(mockShareAsync).not.toHaveBeenCalled();
    expect(mockDeleteAsync).not.toHaveBeenCalled();
  });

  it('suppresses cancelled share errors and still cleans up the temporary PDF', async () => {
    mockShareAsync.mockRejectedValue(new Error('Share canceled by user'));

    await expect(
      shareUtilityReceipt({
        amount: 1000,
        reference: 'ref-123',
        status: 'successful',
        type: 'power',
      })
    ).resolves.toBeUndefined();

    expect(mockDeleteAsync).toHaveBeenCalledWith('file:///tmp/receipt.pdf', {
      idempotent: true,
    });
  });

  it('cleans up the temporary PDF when file sharing fails', async () => {
    mockShareAsync.mockRejectedValue(new Error('Native share failed'));

    await expect(
      shareUtilityReceipt({
        amount: 1000,
        reference: 'ref-123',
        status: 'successful',
        type: 'power',
      })
    ).rejects.toThrow('Native share failed');

    expect(mockDeleteAsync).toHaveBeenCalledWith('file:///tmp/receipt.pdf', {
      idempotent: true,
    });
  });
});
