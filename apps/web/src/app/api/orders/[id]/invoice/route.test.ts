import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateInvoiceBlob } from '@/lib/invoice-generator';
import { createClient } from '@/lib/supabase/server';
import { GET } from './route';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/invoice-generator', () => ({
  generateInvoiceBlob: vi.fn(),
}));

const ORDER_ID = 'cfa945fc-9bf4-4485-857c-4d4374adf31f';
type QueryResult = {
  data: unknown;
  error: unknown;
};
const orderResult: QueryResult = {
  data: {
    id: ORDER_ID,
    order_number: 'ORD-1001',
    created_at: '2026-03-22T10:00:00.000Z',
    subtotal: 500000,
    tax_amount: 0,
    shipping_fee: 0,
    discount_amount: 0,
    total: 500000,
    currency: 'NGN',
    customer_name: 'Ada Customer',
    customer_email: 'ada@example.com',
    customer_phone: '08012345678',
    shipping_address: null,
    fulfillment_details: {
      imei: 'IMEI-123',
      serial_number: 'SN-456',
    },
    merchants: {
      id: 'merchant-1',
      user_id: 'user-1',
      business_name: 'Test Merchant',
      legal_entity_name: null,
      tax_identification_number: null,
      cac_rc_number: null,
      vat_registration_status: 'registered',
      vat_rate: 7.5,
      registered_address: null,
      support_email: null,
      support_phone: null,
      logo_url: null,
    },
  },
  error: null,
};
const orderItemsResult: QueryResult = {
  data: [
    {
      id: 'item-1',
      line_id: 1,
      name: 'Leather Case',
      item_description: null,
      quantity: 1,
      price: 10000,
      unit_code: 'EA',
      line_extension_amount: 10000,
      vat_category_code: 'S',
      vat_rate: 7.5,
      vat_amount: 0,
      sellers_item_id: null,
      product_id: 'product-case',
    },
    {
      id: 'item-2',
      line_id: 2,
      name: 'iPhone 15 Pro',
      item_description: null,
      quantity: 1,
      price: 490000,
      unit_code: 'EA',
      line_extension_amount: 490000,
      vat_category_code: 'S',
      vat_rate: 7.5,
      vat_amount: 0,
      sellers_item_id: null,
      product_id: 'product-phone',
    },
  ],
  error: null,
};
const taxSubtotalsResult: QueryResult = { data: [], error: null };

function createQuery<T>(result: T) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
  };

  return query;
}

function createSupabaseMock({
  items = orderItemsResult,
  order = orderResult,
  taxSubtotals = taxSubtotalsResult,
  user = { id: 'user-1' },
}: {
  items?: QueryResult;
  order?: QueryResult;
  taxSubtotals?: QueryResult;
  user?: { id: string } | null;
} = {}) {
  const orderQuery = createQuery(order);
  const itemsQuery = createQuery(items);
  const taxQuery = createQuery(taxSubtotals);
  const from = vi.fn((table: string) => {
    if (table === 'orders') return orderQuery;
    if (table === 'order_items') return itemsQuery;
    if (table === 'order_tax_subtotals') return taxQuery;
    return createQuery({ data: null, error: null });
  });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
      }),
    },
    from,
  };
}

describe('GET /api/orders/[id]/invoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cookies).mockResolvedValue({ get: vi.fn() } as never);
    vi.mocked(generateInvoiceBlob).mockReturnValue(new Blob(['invoice']));
    vi.mocked(createClient).mockReturnValue(
      createSupabaseMock() as unknown as ReturnType<typeof createClient>
    );
  });

  it('attaches order-level IMEI details only to the device item', async () => {
    const response = await GET(
      new NextRequest(`http://localhost/api/orders/${ORDER_ID}/invoice`),
      { params: Promise.resolve({ id: ORDER_ID }) }
    );

    expect(response.status).toBe(200);

    const invoiceData = vi.mocked(generateInvoiceBlob).mock.calls[0]?.[0] as {
      items: Array<{ description?: string }>;
    };

    expect(invoiceData.items[0]?.description).toBeUndefined();
    expect(invoiceData.items[1]?.description).toContain('IMEI: IMEI-123');
    expect(invoiceData.items[1]?.description).toContain('S/N: SN-456');
  });

  it('attaches order-level IMEI details to the first item when no device item exists', async () => {
    vi.mocked(createClient).mockReturnValue(
      createSupabaseMock({
        items: {
          data: [
            {
              id: 'item-1',
              line_id: 1,
              name: 'Leather Case',
              item_description: null,
              quantity: 1,
              price: 10000,
              unit_code: 'EA',
              line_extension_amount: 10000,
              vat_category_code: 'S',
              vat_rate: 7.5,
              vat_amount: 0,
              sellers_item_id: null,
              product_id: 'product-case',
            },
            {
              id: 'item-2',
              line_id: 2,
              name: 'Screen Protector',
              item_description: null,
              quantity: 1,
              price: 5000,
              unit_code: 'EA',
              line_extension_amount: 5000,
              vat_category_code: 'S',
              vat_rate: 7.5,
              vat_amount: 0,
              sellers_item_id: null,
              product_id: 'product-protector',
            },
          ],
          error: null,
        },
      }) as unknown as ReturnType<typeof createClient>
    );

    const response = await GET(
      new NextRequest(`http://localhost/api/orders/${ORDER_ID}/invoice`),
      { params: Promise.resolve({ id: ORDER_ID }) }
    );

    expect(response.status).toBe(200);

    const invoiceData = vi.mocked(generateInvoiceBlob).mock.calls[0]?.[0] as {
      items: Array<{ description?: string }>;
    };

    expect(invoiceData.items[0]?.description).toContain('IMEI: IMEI-123');
    expect(invoiceData.items[0]?.description).toContain('S/N: SN-456');
    expect(invoiceData.items[1]?.description).toBeUndefined();
  });

  it('returns 401 when the merchant user is not authenticated', async () => {
    vi.mocked(createClient).mockReturnValue(
      createSupabaseMock({ user: null }) as unknown as ReturnType<
        typeof createClient
      >
    );

    const response = await GET(
      new NextRequest(`http://localhost/api/orders/${ORDER_ID}/invoice`),
      { params: Promise.resolve({ id: ORDER_ID }) }
    );

    expect(response.status).toBe(401);
    expect(generateInvoiceBlob).not.toHaveBeenCalled();
  });

  it('returns 400 when the order id is invalid', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/orders/not-a-uuid/invoice'),
      { params: Promise.resolve({ id: 'not-a-uuid' }) }
    );

    expect(response.status).toBe(400);
    expect(generateInvoiceBlob).not.toHaveBeenCalled();
  });

  it('returns 404 when the order lookup does not find a merchant-owned order', async () => {
    vi.mocked(createClient).mockReturnValue(
      createSupabaseMock({
        order: {
          data: null,
          error: { message: 'Order not found' },
        },
      }) as unknown as ReturnType<typeof createClient>
    );

    const response = await GET(
      new NextRequest(`http://localhost/api/orders/${ORDER_ID}/invoice`),
      { params: Promise.resolve({ id: ORDER_ID }) }
    );

    expect(response.status).toBe(404);
    expect(generateInvoiceBlob).not.toHaveBeenCalled();
  });

  it('returns 500 when order items cannot be loaded', async () => {
    vi.mocked(createClient).mockReturnValue(
      createSupabaseMock({
        items: {
          data: null,
          error: { message: 'Database error' },
        },
      }) as unknown as ReturnType<typeof createClient>
    );

    const response = await GET(
      new NextRequest(`http://localhost/api/orders/${ORDER_ID}/invoice`),
      { params: Promise.resolve({ id: ORDER_ID }) }
    );

    expect(response.status).toBe(500);
    expect(generateInvoiceBlob).not.toHaveBeenCalled();
  });
});
