import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockGetMerchantIdForApiUser = vi.fn();
const mockSendEmail = vi.fn();
const mockGenerateOrderDeliveredEmail = vi.fn();
const mockGenerateOrderDeliveredText = vi.fn();
const mockLoggerError = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mockAuthenticateApiRequest,
  getMerchantIdForApiUser: mockGetMerchantIdForApiUser,
}));

vi.mock('@/lib/email-templates', () => ({
  generateOrderDeliveredEmail: mockGenerateOrderDeliveredEmail,
  generateOrderDeliveredText: mockGenerateOrderDeliveredText,
}));

vi.mock('@/lib/zeptomail', () => ({
  sendEmail: mockSendEmail,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: mockLoggerError,
  },
}));

type TableName = 'merchants' | 'merchant_feature_settings' | 'orders';

type QueryResult = {
  data: unknown;
  error: unknown;
};

const mockSupabase = {
  from: vi.fn(),
};

function createQueryBuilder(
  table: TableName,
  queryResults: Record<TableName, QueryResult>
) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(async () => queryResults[table]),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);

  return builder;
}

describe('POST /api/orders/[id]/delivered', () => {
  const orderId = '123e4567-e89b-12d3-a456-426614174000';
  const merchantId = '123e4567-e89b-12d3-a456-426614174001';
  let queryResults: Record<TableName, QueryResult>;
  let queryBuilders: Record<TableName, ReturnType<typeof createQueryBuilder>>;

  beforeEach(() => {
    vi.clearAllMocks();

    queryResults = {
      merchants: {
        data: {
          id: merchantId,
          business_name: 'Test Store',
          slug: 'test-store',
          support_email: 'support@test-store.com',
          email_sender_name: 'Test Store',
          email: 'merchant@test-store.com',
          tax_identification_number: 'TIN-123',
          cac_rc_number: 'RC-123',
        },
        error: null,
      },
      merchant_feature_settings: {
        data: { google_place_id: 'place_123' },
        error: null,
      },
      orders: {
        data: {
          id: orderId,
          order_number: 'ORD-123',
          customer_name: 'Jane Doe',
          customer_email: 'jane@example.com',
          shipping_status: 'delivered',
          order_items: [{ name: 'Product A', quantity: 2 }],
        },
        error: null,
      },
    };

    queryBuilders = {
      merchants: createQueryBuilder('merchants', queryResults),
      merchant_feature_settings: createQueryBuilder(
        'merchant_feature_settings',
        queryResults
      ),
      orders: createQueryBuilder('orders', queryResults),
    };

    mockSupabase.from.mockImplementation((tableName: string) => {
      const builder = queryBuilders[tableName as TableName];
      if (!builder) {
        throw new Error(`Unexpected table: ${tableName}`);
      }
      return builder;
    });

    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      user: { id: 'user-123' },
      supabase: mockSupabase,
    });
    mockGetMerchantIdForApiUser.mockResolvedValue(merchantId);
    mockGenerateOrderDeliveredEmail.mockReturnValue('<html>Delivered</html>');
    mockGenerateOrderDeliveredText.mockReturnValue('Delivered');
    mockSendEmail.mockResolvedValue({
      success: true,
      messageId: 'msg-123',
    });
  });

  function createRequest(currentOrderId: string) {
    return new NextRequest(
      `http://localhost/api/orders/${currentOrderId}/delivered`,
      { method: 'POST' }
    );
  }

  it('returns 400 for an invalid order id before auth or database work', async () => {
    const { POST } = await import('./route');

    const response = await POST(createRequest('not-a-uuid'), {
      params: Promise.resolve({ id: 'not-a-uuid' }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid order ID');
    expect(mockAuthenticateApiRequest).not.toHaveBeenCalled();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('returns 404 when the merchant query fails', async () => {
    queryResults.merchants = {
      data: null,
      error: { message: 'merchant fetch failed' },
    };

    const { POST } = await import('./route');
    const response = await POST(createRequest(orderId), {
      params: Promise.resolve({ id: orderId }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({ error: 'Merchant not found' });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('returns 500 when merchant feature settings cannot be loaded', async () => {
    queryResults.merchant_feature_settings = {
      data: null,
      error: { message: 'settings fetch failed' },
    };

    const { POST } = await import('./route');
    const response = await POST(createRequest(orderId), {
      params: Promise.resolve({ id: orderId }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to load merchant settings' });
    expect(mockLoggerError).toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('returns 404 when the order does not exist for the merchant', async () => {
    queryResults.orders = {
      data: null,
      error: { message: 'order not found' },
    };

    const { POST } = await import('./route');
    const response = await POST(createRequest(orderId), {
      params: Promise.resolve({ id: orderId }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({ error: 'Order not found' });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('sends the delivered notification when merchant, settings, and order all load', async () => {
    const { POST } = await import('./route');
    const response = await POST(createRequest(orderId), {
      params: Promise.resolve({ id: orderId }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      message: 'Delivered notification sent',
      messageId: 'msg-123',
      hasGoogleRating: true,
    });
    expect(mockSupabase.from).toHaveBeenNthCalledWith(1, 'merchants');
    expect(mockSupabase.from).toHaveBeenNthCalledWith(
      2,
      'merchant_feature_settings'
    );
    expect(mockSupabase.from).toHaveBeenNthCalledWith(3, 'orders');
    expect(queryBuilders.orders.eq).toHaveBeenCalledWith('id', orderId);
    expect(queryBuilders.orders.eq).toHaveBeenCalledWith(
      'merchant_id',
      merchantId
    );
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        toName: 'Jane Doe',
        emailType: 'orders',
        fromName: 'Test Store',
      })
    );
  });
});
