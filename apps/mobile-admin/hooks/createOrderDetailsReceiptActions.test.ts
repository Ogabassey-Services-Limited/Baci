import { Alert } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  from: vi.fn(),
  printToFileAsync: vi.fn(),
  resolveVirtualAccount: vi.fn(),
  shareAsync: vi.fn(),
}));

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mocks.from,
  },
}));

vi.mock('./resolveOrderReceiptVirtualAccount', () => ({
  resolveOrderReceiptVirtualAccount: mocks.resolveVirtualAccount,
}));

vi.mock('expo-print', () => ({
  printToFileAsync: (...args: unknown[]) => mocks.printToFileAsync(...args),
}));

vi.mock('expo-sharing', () => ({
  shareAsync: (...args: unknown[]) => mocks.shareAsync(...args),
}));

vi.mock('expo-file-system', () => ({
  File: class MockFile {
    exists = false;
    type = 'application/pdf';
    uri: string;

    constructor(uri: string) {
      this.uri = uri;
    }

    async base64() {
      return 'ZmFrZQ==';
    }

    delete() {
      this.exists = false;
    }

    async move(
      destination: { uri?: string } | string,
      _options?: { overwrite?: boolean }
    ) {
      this.uri =
        typeof destination === 'string'
          ? destination
          : (destination.uri ?? this.uri);
    }

    static async downloadFileAsync() {
      return new MockFile('file:///tmp/logo.png');
    }
  },
  Paths: { cache: '/tmp' },
}));

import { createOrderDetailsReceiptActions } from './createOrderDetailsReceiptActions';

describe('createOrderDetailsReceiptActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', mocks.fetch);
    mocks.resolveVirtualAccount.mockResolvedValue(null);
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
    mocks.printToFileAsync.mockResolvedValue({
      uri: 'file:///tmp/receipt.pdf',
    });
    mocks.shareAsync.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps merchant terms when the merchant pages query returns an error', async () => {
    mocks.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('query failed'),
          }),
        }),
      }),
    });
    const setIsGeneratingReceipt = vi.fn();
    const setReceiptHtml = vi.fn();
    const setShowReceiptPreview = vi.fn();

    const actions = createOrderDetailsReceiptActions({
      isGeneratingReceipt: false,
      merchant: {
        business_name: 'Baci',
        email: 'merchant@example.com',
        id: 'merchant-1',
        pages: { terms: 'No refunds after pickup.' },
      },
      order: {
        amount_paid: 0,
        balance: 15000,
        created_at: '2024-01-01T00:00:00.000Z',
        customer_email: 'customer@example.com',
        customer_name: 'Ada',
        customer_phone: '08030000000',
        discount_amount: 0,
        id: 'order-1',
        items: [],
        order_number: 'ORD-1',
        payment_status: 'pending',
        shipping_address: null,
        shipping_status: 'pending',
        total: 15000,
        updated_at: '2024-01-01T00:00:00.000Z',
      },
      receiptHtml: '',
      setIsGeneratingReceipt,
      setReceiptHtml,
      setShowReceiptPreview,
    });

    await actions.handleSendReceipt();

    expect(setIsGeneratingReceipt).toHaveBeenNthCalledWith(1, true);
    expect(setReceiptHtml).toHaveBeenCalledWith(
      expect.stringContaining('No refunds after pickup.')
    );
    expect(setShowReceiptPreview).toHaveBeenCalledWith(true);
    expect(setIsGeneratingReceipt).toHaveBeenLastCalledWith(false);
  });

  it('generates receipt html and opens the preview on a successful send flow', async () => {
    const setIsGeneratingReceipt = vi.fn();
    const setReceiptHtml = vi.fn();
    const setShowReceiptPreview = vi.fn();

    const actions = createOrderDetailsReceiptActions({
      isGeneratingReceipt: false,
      merchant: {
        business_name: 'Baci',
        email: 'merchant@example.com',
        id: 'merchant-1',
      },
      order: {
        amount_paid: 0,
        balance: 15000,
        created_at: '2024-01-01T00:00:00.000Z',
        customer_email: 'customer@example.com',
        customer_name: 'Ada',
        customer_phone: '08030000000',
        discount_amount: 0,
        id: 'order-1',
        items: [],
        order_number: 'ORD-1',
        payment_status: 'pending',
        shipping_address: null,
        shipping_status: 'pending',
        total: 15000,
        updated_at: '2024-01-01T00:00:00.000Z',
      },
      receiptHtml: '',
      setIsGeneratingReceipt,
      setReceiptHtml,
      setShowReceiptPreview,
    });

    await actions.handleSendReceipt();

    expect(setIsGeneratingReceipt).toHaveBeenNthCalledWith(1, true);
    expect(setReceiptHtml).toHaveBeenCalledWith(expect.any(String));
    expect(setShowReceiptPreview).toHaveBeenCalledWith(true);
    expect(setIsGeneratingReceipt).toHaveBeenLastCalledWith(false);
  });

  it('includes saved fulfillment identifiers in the generated receipt html', async () => {
    const setReceiptHtml = vi.fn();

    const actions = createOrderDetailsReceiptActions({
      isGeneratingReceipt: false,
      merchant: {
        business_name: 'Baci',
        email: 'merchant@example.com',
        id: 'merchant-1',
      },
      order: {
        amount_paid: 15000,
        balance: 0,
        created_at: '2024-01-01T00:00:00.000Z',
        customer_email: 'customer@example.com',
        customer_name: 'Ada',
        customer_phone: '08030000000',
        discount_amount: 0,
        fulfillment_details: {
          imei: '353456789012345',
          serialNumber: 'SN-123',
        },
        id: 'order-1',
        items: [],
        order_number: 'ORD-1',
        payment_status: 'paid',
        shipping_address: null,
        shipping_status: 'pending',
        total: 15000,
        updated_at: '2024-01-01T00:00:00.000Z',
      },
      receiptHtml: '',
      setIsGeneratingReceipt: vi.fn(),
      setReceiptHtml,
      setShowReceiptPreview: vi.fn(),
    });

    await actions.handleSendReceipt();

    expect(setReceiptHtml).toHaveBeenCalledWith(
      expect.stringContaining('353456789012345')
    );
    expect(setReceiptHtml).toHaveBeenCalledWith(
      expect.stringContaining('SN-123')
    );
  });

  it('sanitizes fetched svg logos before previewing the receipt', async () => {
    mocks.fetch.mockResolvedValue({
      ok: true,
      text: async () => '<svg><script>alert(1)</script><rect /></svg>',
    });
    const setReceiptHtml = vi.fn();

    const actions = createOrderDetailsReceiptActions({
      isGeneratingReceipt: false,
      merchant: {
        business_name: 'Baci',
        email: 'merchant@example.com',
        id: 'merchant-1',
        logo_url: 'https://example.com/logo.svg',
      },
      order: {
        amount_paid: 0,
        balance: 15000,
        created_at: '2024-01-01T00:00:00.000Z',
        customer_email: 'customer@example.com',
        customer_name: 'Ada',
        customer_phone: '08030000000',
        discount_amount: 0,
        id: 'order-1',
        items: [],
        order_number: 'ORD-1',
        payment_status: 'pending',
        shipping_address: null,
        shipping_status: 'pending',
        total: 15000,
        updated_at: '2024-01-01T00:00:00.000Z',
      },
      receiptHtml: '',
      setIsGeneratingReceipt: vi.fn(),
      setReceiptHtml,
      setShowReceiptPreview: vi.fn(),
    });

    await actions.handleSendReceipt();

    expect(setReceiptHtml).toHaveBeenCalledWith(
      expect.not.stringContaining('<script>')
    );
    expect(setReceiptHtml).toHaveBeenCalledWith(
      expect.stringContaining('<svg')
    );
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('shares the generated receipt pdf when receipt html is available', async () => {
    const actions = createOrderDetailsReceiptActions({
      isGeneratingReceipt: false,
      merchant: {
        business_name: 'Baci',
        email: 'merchant@example.com',
        id: 'merchant-1',
      },
      order: {
        amount_paid: 15000,
        balance: 0,
        created_at: '2024-01-01T00:00:00.000Z',
        customer_email: 'customer@example.com',
        customer_name: 'Ada',
        customer_phone: '08030000000',
        discount_amount: 0,
        id: 'order-1',
        items: [],
        order_number: 'ORD-1',
        payment_status: 'paid',
        shipping_address: null,
        shipping_status: 'pending',
        total: 15000,
        updated_at: '2024-01-01T00:00:00.000Z',
      },
      receiptHtml: '<html><body>receipt</body></html>',
      setIsGeneratingReceipt: vi.fn(),
      setReceiptHtml: vi.fn(),
      setShowReceiptPreview: vi.fn(),
    });

    await actions.handleShareReceiptPdf();

    expect(mocks.printToFileAsync).toHaveBeenCalledWith({
      html: '<html><body>receipt</body></html>',
    });
    expect(mocks.shareAsync).toHaveBeenCalledTimes(1);
  });
});
