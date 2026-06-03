import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generatePeppolInvoiceXml } from '@/lib/peppol-ubl-invoice';
import {
  generateReceiptBlob,
  resolveReceiptLogoDataUri,
} from '@/lib/receipt-pdf-generator';
import { createClient } from '@/lib/supabase/server';
import { GET } from './route';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/peppol-ubl-invoice', () => ({
  generatePeppolInvoiceXml: vi.fn(() => '<Invoice />'),
  PEPPOL_BIS_BILLING_COMPLIANCE_NOTE:
    'This invoice complies with Peppol BIS Billing 3.0 through a generated UBL XML invoice artifact created from this order.',
}));

vi.mock('@/lib/receipt-pdf-generator', () => ({
  generateReceiptBlob: vi.fn(),
  resolveReceiptLogoDataUri: vi.fn(() => Promise.resolve(null)),
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
      email: 'merchant@example.com',
      phone: '08000000000',
      business_address: '12 Allen Avenue',
      support_email: null,
      support_phone: null,
      logo_url: null,
      brand_colors: null,
      bank_code: null,
      bank_account_number: null,
      bank_name: null,
      bank_account_name: null,
      social_media: null,
      pages: null,
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
const paymentAccountsResult: QueryResult = {
  data: [
    {
      account_number: '1234567890',
      bank_name: 'Wema Bank',
      account_name: 'OgaBassey-Test',
    },
  ],
  error: null,
};

type SupabaseQueryMock = Record<
  'select' | 'eq' | 'limit' | 'order' | 'single',
  ReturnType<typeof vi.fn>
>;

function createQuery<T>(result: T, options: { chainOrder?: boolean } = {}) {
  const query = {} as SupabaseQueryMock;

  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.limit = vi.fn().mockResolvedValue(result);
  query.order = options.chainOrder
    ? vi.fn(() => query)
    : vi.fn().mockResolvedValue(result);
  query.single = vi.fn().mockResolvedValue(result);

  return query;
}

function createSupabaseMock({
  items = orderItemsResult,
  order = orderResult,
  paymentAccounts = paymentAccountsResult,
  taxSubtotals = taxSubtotalsResult,
  user = { id: 'user-1' },
}: {
  items?: QueryResult;
  order?: QueryResult;
  paymentAccounts?: QueryResult;
  taxSubtotals?: QueryResult;
  user?: { id: string } | null;
} = {}) {
  const orderQuery = createQuery(order);
  const itemsQuery = createQuery(items);
  const paymentAccountsQuery = createQuery(paymentAccounts, {
    chainOrder: true,
  });
  const taxQuery = createQuery(taxSubtotals);
  const from = vi.fn((table: string) => {
    if (table === 'orders') return orderQuery;
    if (table === 'order_items') return itemsQuery;
    if (table === 'order_payment_accounts') return paymentAccountsQuery;
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

function createOrderResultWithFulfillment(
  fulfillmentDetails: Record<string, string | null>
): QueryResult {
  return {
    data: {
      ...(orderResult.data as Record<string, unknown>),
      fulfillment_details: fulfillmentDetails,
    },
    error: null,
  };
}

function getGeneratedInvoiceItems() {
  const invoiceData = vi.mocked(generatePeppolInvoiceXml).mock
    .calls[0]?.[0] as {
    items: Array<{ description?: string }>;
  };

  return invoiceData.items;
}

describe('GET /api/orders/[id]/invoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cookies).mockResolvedValue({ get: vi.fn() } as never);
    vi.mocked(generatePeppolInvoiceXml).mockReturnValue('<Invoice />');
    vi.mocked(generateReceiptBlob).mockReturnValue(new Blob(['invoice']));
    vi.mocked(resolveReceiptLogoDataUri).mockResolvedValue(
      'data:image/png;base64,AA=='
    );
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

    const invoiceItems = getGeneratedInvoiceItems();

    expect(invoiceItems[0]?.description).toBeUndefined();
    expect(invoiceItems[1]?.description).toContain('IMEI: IMEI-123');
    expect(invoiceItems[1]?.description).toContain('S/N: SN-456');
    expect(generateReceiptBlob).toHaveBeenCalledWith(
      expect.objectContaining({
        order_number: 'ORD-1001',
        virtual_account: expect.objectContaining({
          account_number: '1234567890',
          bank_name: 'Wema Bank',
        }),
      }),
      expect.objectContaining({ business_name: 'Test Merchant' }),
      expect.objectContaining({
        complianceNote: expect.stringContaining('Peppol BIS Billing 3.0'),
        documentKind: 'invoice',
        logoDataUri: 'data:image/png;base64,AA==',
      })
    );
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

    const invoiceItems = getGeneratedInvoiceItems();

    expect(invoiceItems[0]?.description).toContain('IMEI: IMEI-123');
    expect(invoiceItems[0]?.description).toContain('S/N: SN-456');
    expect(invoiceItems[1]?.description).toBeUndefined();
  });

  it('attaches camelCase serialNumber fulfillment details to the device item', async () => {
    vi.mocked(createClient).mockReturnValue(
      createSupabaseMock({
        order: createOrderResultWithFulfillment({
          imei: 'IMEI-789',
          serialNumber: 'SN-CAMEL',
        }),
      }) as unknown as ReturnType<typeof createClient>
    );

    const response = await GET(
      new NextRequest(`http://localhost/api/orders/${ORDER_ID}/invoice`),
      { params: Promise.resolve({ id: ORDER_ID }) }
    );

    expect(response.status).toBe(200);

    const invoiceItems = getGeneratedInvoiceItems();

    expect(invoiceItems[0]?.description).toBeUndefined();
    expect(invoiceItems[1]?.description).toContain('IMEI: IMEI-789');
    expect(invoiceItems[1]?.description).toContain('S/N: SN-CAMEL');
  });

  it('attaches IMEI-only fulfillment details without adding a serial label', async () => {
    vi.mocked(createClient).mockReturnValue(
      createSupabaseMock({
        order: createOrderResultWithFulfillment({
          imei: 'IMEI-ONLY',
          serial_number: null,
        }),
      }) as unknown as ReturnType<typeof createClient>
    );

    const response = await GET(
      new NextRequest(`http://localhost/api/orders/${ORDER_ID}/invoice`),
      { params: Promise.resolve({ id: ORDER_ID }) }
    );

    expect(response.status).toBe(200);

    const invoiceItems = getGeneratedInvoiceItems();

    expect(invoiceItems[1]?.description).toContain('IMEI: IMEI-ONLY');
    expect(invoiceItems[1]?.description).not.toContain('S/N:');
  });

  it('attaches serial-only fulfillment details without adding an IMEI label', async () => {
    vi.mocked(createClient).mockReturnValue(
      createSupabaseMock({
        order: createOrderResultWithFulfillment({
          imei: null,
          serial_number: 'SN-ONLY',
        }),
      }) as unknown as ReturnType<typeof createClient>
    );

    const response = await GET(
      new NextRequest(`http://localhost/api/orders/${ORDER_ID}/invoice`),
      { params: Promise.resolve({ id: ORDER_ID }) }
    );

    expect(response.status).toBe(200);

    const invoiceItems = getGeneratedInvoiceItems();

    expect(invoiceItems[1]?.description).toContain('S/N: SN-ONLY');
    expect(invoiceItems[1]?.description).not.toContain('IMEI:');
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
    expect(generateReceiptBlob).not.toHaveBeenCalled();
  });

  it('returns 400 when the order id is invalid', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/orders/not-a-uuid/invoice'),
      { params: Promise.resolve({ id: 'not-a-uuid' }) }
    );

    expect(response.status).toBe(400);
    expect(generateReceiptBlob).not.toHaveBeenCalled();
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
    expect(generateReceiptBlob).not.toHaveBeenCalled();
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
    expect(generateReceiptBlob).not.toHaveBeenCalled();
  });
});
