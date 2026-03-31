import type { SupabaseClient, User } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthResult } from '@/lib/api-auth';

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(),
}));

import { authenticateApiRequest } from '@/lib/api-auth';
import { GET } from './route';

interface QueryResult<TData> {
  data: TData | null;
  error: { message: string } | null;
}

function createSingleQuery<TData>(result: QueryResult<TData>) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.single.mockResolvedValue(result);
  return query;
}

function createOrdersQuery<TData>(result: QueryResult<TData>) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockResolvedValue(result);
  return query;
}

function createSupabaseMock(input?: {
  merchant?: QueryResult<{ id: string } | null>;
  customer?: QueryResult<{ id: string } | null>;
  orders?: QueryResult<
    Array<{
      id: string;
      order_number: string;
      created_at: string;
      total: number;
      subtotal: number;
      shipping_fee: number;
      tax_amount: number;
      discount_amount: number;
      amount_paid: number;
      currency: string;
      external_source?: string | null;
      import_job_id?: string | null;
      payment_status: string;
      shipping_status: string;
      shipping_address: Record<string, unknown> | null;
      tracking_number: string | null;
      shipping_provider: string | null;
      payment_method: string | null;
      order_items: Array<{
        id: string;
        product_id: string;
        name: string;
        quantity: number;
        price: number;
        has_assurance: boolean | null;
        products?: {
          slug?: string;
          category?: string | null;
          category_slug?: string | null;
          categories?: { name?: string; slug?: string }[] | null;
        } | null;
      }>;
    }>
  >;
}) {
  const merchantQuery = createSingleQuery(
    input?.merchant ?? {
      data: { id: 'merchant-1' },
      error: null,
    }
  );
  const customerQuery = createSingleQuery(
    input?.customer ?? {
      data: { id: 'customer-1' },
      error: null,
    }
  );
  const ordersQuery = createOrdersQuery(
    input?.orders ?? {
      data: [],
      error: null,
    }
  );

  return {
    from: vi.fn((table: string) => {
      if (table === 'merchants') {
        return merchantQuery;
      }

      if (table === 'customers') {
        return customerQuery;
      }

      if (table === 'orders') {
        return ordersQuery;
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  } as unknown as SupabaseClient;
}

function createAuthenticatedAuthResult(supabase: SupabaseClient): AuthResult {
  return {
    user: { id: 'user-1' } as User,
    error: null,
    supabase,
  };
}

describe('GET /api/storefront/orders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when the customer is not authenticated', async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });

    const response = await GET(
      new NextRequest(
        'http://localhost/api/storefront/orders?merchantSlug=ogabassey'
      )
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 when merchantSlug is missing', async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue(
      createAuthenticatedAuthResult(createSupabaseMock())
    );

    const response = await GET(
      new NextRequest('http://localhost/api/storefront/orders')
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid request',
      details: expect.any(Object),
    });
  });

  it('returns 400 when merchantSlug is invalid', async () => {
    const supabase = createSupabaseMock();
    const authResult = createAuthenticatedAuthResult(supabase);
    vi.mocked(authenticateApiRequest).mockResolvedValue(authResult);

    const response = await GET(
      new NextRequest(
        'http://localhost/api/storefront/orders?merchantSlug=bad slug'
      )
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid request',
      details: expect.any(Object),
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns 404 when the merchant cannot be found', async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue(
      createAuthenticatedAuthResult(
        createSupabaseMock({
          merchant: {
            data: null,
            error: { message: 'not found' },
          },
        })
      )
    );

    const response = await GET(
      new NextRequest(
        'http://localhost/api/storefront/orders?merchantSlug=ogabassey'
      )
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Store not found',
    });
  });

  it('returns an empty order list when the customer has no merchant record yet', async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue(
      createAuthenticatedAuthResult(
        createSupabaseMock({
          customer: {
            data: null,
            error: { message: 'not found' },
          },
        })
      )
    );

    const response = await GET(
      new NextRequest(
        'http://localhost/api/storefront/orders?merchantSlug=ogabassey'
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ orders: [] });
  });

  it('returns transformed customer orders with document metadata', async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue(
      createAuthenticatedAuthResult(
        createSupabaseMock({
          orders: {
            data: [
              {
                id: 'order-1',
                order_number: 'ORD-1001',
                created_at: '2026-03-22T10:00:00.000Z',
                total: 150000,
                subtotal: 140000,
                shipping_fee: 5000,
                tax_amount: 10000,
                discount_amount: 0,
                amount_paid: 150000,
                currency: 'NGN',
                external_source: null,
                import_job_id: null,
                payment_status: 'PAID',
                shipping_status: 'Delivered',
                shipping_address: { city: 'Lagos' },
                tracking_number: 'TRACK-1',
                shipping_provider: 'GIGL',
                payment_method: 'card',
                order_items: [
                  {
                    id: 'item-1',
                    product_id: 'product-1',
                    name: 'Imported Product',
                    quantity: 2,
                    price: 70000,
                    has_assurance: false,
                    products: {
                      slug: 'imported-product',
                      category: 'smartphones',
                      category_slug: 'smartphones',
                      categories: [
                        { name: 'Smartphones', slug: 'smartphones' },
                      ],
                    },
                  },
                ],
              },
            ],
            error: null,
          },
        })
      )
    );

    const response = await GET(
      new NextRequest(
        'http://localhost/api/storefront/orders?merchantSlug=ogaBassey'
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      orders: [
        {
          id: 'order-1',
          order_number: 'ORD-1001',
          created_at: '2026-03-22T10:00:00.000Z',
          total: 150000,
          subtotal: 140000,
          shipping_fee: 5000,
          tax_amount: 10000,
          discount_amount: 0,
          amount_paid: 150000,
          currency: 'NGN',
          payment_status: 'paid',
          shipping_status: 'delivered',
          shipping_address: { city: 'Lagos' },
          tracking_number: 'TRACK-1',
          shipping_provider: 'GIGL',
          payment_method: 'card',
          balance: 0,
          current_document_kind: 'receipt',
          receipt_eligible: true,
          items: [
            {
              id: 'item-1',
              product_id: 'product-1',
              name: 'Imported Product',
              quantity: 2,
              price: 70000,
              has_assurance: false,
              product_slug: 'imported-product',
              category: 'smartphones',
              category_slug: 'smartphones',
              categories: { name: 'Smartphones', slug: 'smartphones' },
            },
          ],
        },
      ],
    });
  });

  it('treats imported paid orders as receipt-ready even when shipping is still processing', async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue(
      createAuthenticatedAuthResult(
        createSupabaseMock({
          orders: {
            data: [
              {
                id: 'order-imported',
                order_number: 'ORD-2001',
                created_at: '2026-03-22T10:00:00.000Z',
                total: 150000,
                subtotal: 140000,
                shipping_fee: 5000,
                tax_amount: 10000,
                discount_amount: 0,
                amount_paid: 150000,
                currency: 'NGN',
                external_source: 'bumpa',
                import_job_id: 'job-1',
                payment_status: 'PAID',
                shipping_status: 'Processing',
                shipping_address: { city: 'Lagos' },
                tracking_number: null,
                shipping_provider: null,
                payment_method: 'imported',
                order_items: [],
              },
            ],
            error: null,
          },
        })
      )
    );

    const response = await GET(
      new NextRequest(
        'http://localhost/api/storefront/orders?merchantSlug=ogabassey'
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      orders: [
        expect.objectContaining({
          id: 'order-imported',
          shipping_status: 'processing',
          current_document_kind: 'receipt',
          receipt_eligible: true,
        }),
      ],
    });
  });

  it('returns 500 when the orders query fails', async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue(
      createAuthenticatedAuthResult(
        createSupabaseMock({
          orders: {
            data: null,
            error: { message: 'boom' },
          },
        })
      )
    );

    const response = await GET(
      new NextRequest(
        'http://localhost/api/storefront/orders?merchantSlug=ogabassey'
      )
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to fetch orders',
    });
  });
});
