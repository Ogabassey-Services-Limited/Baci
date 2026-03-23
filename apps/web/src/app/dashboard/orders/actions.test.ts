import { describe, expect, it, vi } from 'vitest';

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(new Map())),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

// Mock email functions
const mockGenerateOrderConfirmationEmail = vi.fn<any>(
  () => '<html>confirmation</html>'
);
const mockGenerateOrderConfirmationText = vi.fn<any>(() => 'confirmation text');

vi.mock('@/lib/email-templates', () => ({
  generateOrderConfirmationEmail: mockGenerateOrderConfirmationEmail,
  generateOrderConfirmationText: mockGenerateOrderConfirmationText,
}));

// Mock sendEmail
const mockSendEmail = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/zeptomail', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

// Mock sanitize functions
vi.mock('@/lib/sanitize-core', () => ({
  sanitizeLikePattern: (s: string) => s,
  sanitizeSearchQuery: (s: string) => s,
}));

// Supabase mock setup
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

// Import after mocks
const { getOrder, resendOrderConfirmation } = await import('./actions');

const ORDER_ID = 'order-123';
const MERCHANT_ID = 'merchant-456';

const mockOrder = {
  id: ORDER_ID,
  merchant_id: MERCHANT_ID,
  order_number: '#ORD-001',
  customer_name: 'John Doe',
  customer_email: 'john@example.com',
  customer_phone: '+2348012345678',
  shipping_status: 'pending',
  payment_status: 'paid',
  payment_method: 'card',
  created_at: '2026-03-23T08:00:00.000Z',
  source: 'whatsapp',
  subtotal: '10000',
  shipping_fee: '1500',
  total: '11500',
  shipping_address: {
    address: '123 Test St',
    city: 'Lagos',
    state: 'Lagos',
  },
  order_items: [
    {
      id: 'item-1',
      name: 'Widget',
      product_id: 'product-1',
      quantity: 2,
      price: 5000,
    },
  ],
};

const mockMerchant: {
  business_name: string;
  slug: string;
  support_email: string;
  email_sender_name: string;
  email: string;
  tax_identification_number: string | null;
  cac_rc_number: string | null;
} = {
  business_name: 'TestShop',
  slug: 'testshop',
  support_email: 'support@testshop.com',
  email_sender_name: 'TestShop',
  email: 'owner@testshop.com',
  tax_identification_number: '1234567890',
  cac_rc_number: 'RC-12345',
};

function setupMocks(overrides?: {
  order?: typeof mockOrder | null;
  orderError?: { message: string } | null;
  merchant?: typeof mockMerchant | null;
  merchantError?: { message: string } | null;
}) {
  const order = overrides?.order !== undefined ? overrides.order : mockOrder;
  const orderError = overrides?.orderError ?? null;
  const merchant =
    overrides?.merchant !== undefined ? overrides.merchant : mockMerchant;
  const merchantError = overrides?.merchantError ?? null;

  mockGetUser.mockResolvedValue({
    data: { user: { id: 'admin-user' } },
  });

  mockFrom.mockImplementation((table: string) => {
    if (table === 'orders') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({ data: order, error: orderError })
            ),
          })),
        })),
      };
    }
    if (table === 'merchants') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({ data: merchant, error: merchantError })
            ),
          })),
        })),
      };
    }
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    };
  });
}

describe('resendOrderConfirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns failure when order is not found', async () => {
    setupMocks({ order: null, orderError: { message: 'Not found' } });

    const result = await resendOrderConfirmation(ORDER_ID);
    expect(result.success).toBe(false);
    expect(result.message).toBe('Order not found');
  });

  it('returns failure when customer has no email', async () => {
    setupMocks({
      order: { ...mockOrder, customer_email: '' },
    });

    const result = await resendOrderConfirmation(ORDER_ID);
    expect(result.success).toBe(false);
    expect(result.message).toBe('Customer has no email address');
  });

  it('returns failure when merchant is not found', async () => {
    setupMocks({
      merchant: null,
      merchantError: { message: 'Not found' },
    });

    const result = await resendOrderConfirmation(ORDER_ID);
    expect(result.success).toBe(false);
    expect(result.message).toBe('Merchant profile not found');
  });

  it('sends email successfully and returns success', async () => {
    setupMocks();

    const result = await resendOrderConfirmation(ORDER_ID);
    expect(result.success).toBe(true);
    expect(result.message).toBe('Order confirmation email sent successfully');
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  it('passes merchantTin and merchantRcNumber to email template', async () => {
    setupMocks();

    await resendOrderConfirmation(ORDER_ID);

    expect(mockGenerateOrderConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantTin: '1234567890',
        merchantRcNumber: 'RC-12345',
      })
    );
    expect(mockGenerateOrderConfirmationText).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantTin: '1234567890',
        merchantRcNumber: 'RC-12345',
      })
    );
  });

  it('passes undefined for merchantTin when merchant has no TIN', async () => {
    setupMocks({
      merchant: {
        ...mockMerchant,
        tax_identification_number: null,
        cac_rc_number: null,
      },
    });

    await resendOrderConfirmation(ORDER_ID);

    expect(mockGenerateOrderConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantTin: undefined,
        merchantRcNumber: undefined,
      })
    );
  });

  it('includes correct order data in email template', async () => {
    setupMocks();

    await resendOrderConfirmation(ORDER_ID);

    expect(mockGenerateOrderConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        orderNumber: '#ORD-001',
        customerName: 'John Doe',
        merchantName: 'TestShop',
        total: 11500,
      })
    );
  });

  it('sends email to correct recipient', async () => {
    setupMocks();

    await resendOrderConfirmation(ORDER_ID);

    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'john@example.com',
        toName: 'John Doe',
        emailType: 'orders',
      })
    );
  });

  it('returns failure message on unexpected error', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('Network error');
    });

    const result = await resendOrderConfirmation(ORDER_ID);
    expect(result.success).toBe(false);
    expect(result.message).toBe('Failed to send email. Please try again.');
  });
});

describe('getOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockGetOrderQueries(options?: {
    orderRows?: (typeof mockOrder)[];
    orderError?: { message: string } | null;
  }) {
    const orderRows = options?.orderRows ?? [mockOrder];
    const orderError = options?.orderError ?? null;
    const ordersOr = vi
      .fn()
      .mockResolvedValue({ data: orderRows, error: orderError });
    const ordersMaybeSingle = vi
      .fn()
      .mockResolvedValue({ data: orderRows[0] ?? null, error: orderError });
    const productsIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'product-1',
          images: ['https://cdn.example.com/products/widget.avif'],
        },
      ],
      error: null,
    });
    const transactionsOrder = vi
      .fn()
      .mockResolvedValue({ data: [], error: null });
    const ordersSelect = vi.fn(() => ({
      eq: vi.fn((column: string, value: string) => {
        if (column !== 'merchant_id' || value !== MERCHANT_ID) {
          throw new Error(`Unexpected order filter ${column}=${value}`);
        }

        return {
          eq: vi.fn((nestedColumn: string, nestedValue: string) => {
            expect(nestedColumn).toBe('id');
            return {
              maybeSingle: vi.fn(() => {
                expect(nestedValue).toBe(ORDER_ID);
                return ordersMaybeSingle();
              }),
            };
          }),
          or: ordersOr,
        };
      }),
    }));
    const productsSelect = vi.fn(() => ({ in: productsIn }));
    const transactionsSelect = vi.fn(() => ({
      eq: vi.fn((column: string, value: string) => {
        expect(column).toBe('order_id');
        expect(value).toBe(ORDER_ID);
        return { order: transactionsOrder };
      }),
    }));

    mockFrom.mockImplementation((table: string) => {
      if (table === 'orders') {
        return { select: ordersSelect };
      }

      if (table === 'products') {
        return { select: productsSelect };
      }

      if (table === 'transactions') {
        return { select: transactionsSelect };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    return {
      ordersOr,
      ordersSelect,
      productsIn,
      productsSelect,
      transactionsOrder,
    };
  }

  it('fetches an order case-insensitively by order number', async () => {
    const { ordersOr, productsIn, productsSelect } = mockGetOrderQueries();

    const order = await getOrder(MERCHANT_ID, 'ord-001');

    expect(order?.id).toBe(ORDER_ID);
    expect(order?.orderNumber).toBe('#ORD-001');
    expect(order?.items[0]?.image).toBe(
      'https://cdn.example.com/products/widget.avif'
    );
    expect(ordersOr).toHaveBeenCalledWith(
      expect.stringContaining('order_number.ilike.ord-001')
    );
    expect(productsSelect).toHaveBeenCalledWith('id, images');
    expect(productsIn).toHaveBeenCalledWith('id', ['product-1']);
  });

  it('preserves storefront order sources for dashboard labels', async () => {
    mockGetOrderQueries({
      orderRows: [{ ...mockOrder, source: 'online_store' }],
    });

    const order = await getOrder(MERCHANT_ID, 'ord-001');

    expect(order?.source).toBe('online_store');
  });

  it('formats legacy lowercase customer names for display', async () => {
    mockGetOrderQueries({
      orderRows: [{ ...mockOrder, customer_name: 'chidimma azubuike' }],
    });

    const order = await getOrder(MERCHANT_ID, 'ord-001');

    expect(order?.customerName).toBe('Chidimma Azubuike');
  });

  it('returns null when the order does not exist', async () => {
    const { ordersOr, productsSelect, transactionsOrder } = mockGetOrderQueries(
      {
        orderRows: [],
      }
    );

    const order = await getOrder(MERCHANT_ID, 'ord-001');

    expect(order).toBeNull();
    expect(ordersOr).toHaveBeenCalledOnce();
    expect(productsSelect).not.toHaveBeenCalled();
    expect(transactionsOrder).not.toHaveBeenCalled();
  });

  it('returns null when the order lookup is rejected as unauthenticated', async () => {
    const { ordersOr, productsSelect, transactionsOrder } = mockGetOrderQueries(
      {
        orderRows: [],
        orderError: { message: 'Unauthenticated' },
      }
    );

    const order = await getOrder(MERCHANT_ID, 'ord-001');

    expect(order).toBeNull();
    expect(ordersOr).toHaveBeenCalledOnce();
    expect(productsSelect).not.toHaveBeenCalled();
    expect(transactionsOrder).not.toHaveBeenCalled();
  });

  it('returns null when the order query fails', async () => {
    const { ordersOr, productsSelect, transactionsOrder } = mockGetOrderQueries(
      {
        orderRows: [],
        orderError: { message: 'DB error' },
      }
    );

    const order = await getOrder(MERCHANT_ID, 'ord-001');

    expect(order).toBeNull();
    expect(ordersOr).toHaveBeenCalledOnce();
    expect(productsSelect).not.toHaveBeenCalled();
    expect(transactionsOrder).not.toHaveBeenCalled();
  });
});
