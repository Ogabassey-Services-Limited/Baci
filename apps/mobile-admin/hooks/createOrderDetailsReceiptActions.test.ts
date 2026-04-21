import { Alert } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
}));

vi.mock('@baci/shared', () => ({
  generateReceiptHtml: vi.fn(() => '<html>receipt</html>'),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null }),
        })),
      })),
    })),
  },
}));

vi.mock('./resolveOrderReceiptVirtualAccount', () => ({
  resolveOrderReceiptVirtualAccount: vi.fn().mockResolvedValue(null),
}));

import { createOrderDetailsReceiptActions } from './createOrderDetailsReceiptActions';

describe('createOrderDetailsReceiptActions', () => {
  it('returns early without calling setIsGeneratingReceipt when order is missing', async () => {
    const setIsGeneratingReceipt = vi.fn();
    const actions = createOrderDetailsReceiptActions({
      isGeneratingReceipt: false,
      merchant: { id: 'merchant-1', business_name: 'Acme' },
      order: undefined,
      receiptHtml: '',
      setIsGeneratingReceipt,
      setReceiptHtml: vi.fn(),
      setShowReceiptPreview: vi.fn(),
    });

    await actions.handleSendReceipt();

    expect(setIsGeneratingReceipt).not.toHaveBeenCalled();
  });

  it('returns early without calling setIsGeneratingReceipt when merchant is missing', async () => {
    const setIsGeneratingReceipt = vi.fn();
    const actions = createOrderDetailsReceiptActions({
      isGeneratingReceipt: false,
      merchant: null,
      order: { id: 'order-1', order_number: 'ORD-1' } as never,
      receiptHtml: '',
      setIsGeneratingReceipt,
      setReceiptHtml: vi.fn(),
      setShowReceiptPreview: vi.fn(),
    });

    await actions.handleSendReceipt();

    expect(setIsGeneratingReceipt).not.toHaveBeenCalled();
  });

  it('does nothing in handleShareReceiptPdf when receiptHtml is empty', async () => {
    const actions = createOrderDetailsReceiptActions({
      isGeneratingReceipt: false,
      merchant: { id: 'merchant-1' },
      order: undefined,
      receiptHtml: '',
      setIsGeneratingReceipt: vi.fn(),
      setReceiptHtml: vi.fn(),
      setShowReceiptPreview: vi.fn(),
    });

    await actions.handleShareReceiptPdf();

    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
