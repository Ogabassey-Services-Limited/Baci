import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedImportedOrder } from '@/lib/imports/bumpa/bumpa-types';

vi.mock('@/lib/import-commit/resolve-import-customer', () => ({
  createImportCustomerResolver: vi.fn(),
}));

import { commitBumpaOrders } from '@/lib/import-commit/commit-bumpa-orders';
import { createImportCustomerResolver } from '@/lib/import-commit/resolve-import-customer';

function createOrder(
  overrides: Partial<NormalizedImportedOrder> = {}
): NormalizedImportedOrder {
  return {
    sourcePlatform: 'bumpa',
    externalSourceId: 'ext-1',
    orderNumber: 'ORD-1001',
    customer: {
      fullName: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: '+2347000000000',
      claimable: true,
    },
    shippingStatus: 'delivered',
    paymentStatus: 'paid',
    sourceOrderStatus: 'fulfilled',
    sourceShippingStatus: 'delivered',
    total: 25000,
    subtotal: 24000,
    shippingFee: 1000,
    taxAmount: 0,
    discountAmount: 0,
    amountPaid: 25000,
    amountDue: 0,
    currency: 'NGN',
    orderDate: '2026-03-20T10:00:00.000Z',
    createdAt: '2026-03-20T10:00:00.000Z',
    updatedAt: '2026-03-21T10:00:00.000Z',
    couponCode: null,
    shippingOption: 'Door delivery',
    shippingAddress: null,
    sourceChannel: 'instagram',
    sourceOrigin: 'manual',
    receiptReady: true,
    importMetadata: {},
    items: [
      {
        productId: 'product-1',
        productName: 'Imported Phone',
        sku: 'SKU-1',
        quantity: 2,
        unitPrice: 12500,
        lineTotal: 25000,
        matched: true,
        matchSource: 'sku',
      },
    ],
    ...overrides,
  };
}

interface ExistingOrderFixture {
  id: string;
  external_id: string | null;
  tracking_token: string;
  fulfillment_details?: Record<string, unknown> | null;
  shipping_address?: Record<string, unknown> | null;
}

interface CreateSupabaseMockOptions {
  existingOrders?: ExistingOrderFixture[];
  insertedOrder?: ExistingOrderFixture | null;
  insertOrderError?: { message: string } | null;
  updateOrderError?: { message: string } | null;
  deleteItemsError?: { message: string } | null;
  insertItemsError?: { message: string } | null;
}

function createSupabaseMock({
  existingOrders = [],
  insertedOrder = {
    id: 'order-new',
    external_id: 'ext-1',
    tracking_token: 'tracking-1',
  },
  insertOrderError = null,
  updateOrderError = null,
  deleteItemsError = null,
  insertItemsError = null,
}: CreateSupabaseMockOptions = {}) {
  const loadQuery = {
    select: vi.fn(),
    eq: vi.fn(),
  };
  loadQuery.select.mockReturnValue(loadQuery);
  loadQuery.eq
    .mockReturnValueOnce(loadQuery)
    .mockResolvedValueOnce({ data: existingOrders, error: null });

  const insertOrderQuery = {
    insert: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
  };
  insertOrderQuery.insert.mockReturnValue(insertOrderQuery);
  insertOrderQuery.select.mockReturnValue(insertOrderQuery);
  insertOrderQuery.single.mockResolvedValue({
    data: insertedOrder,
    error: insertOrderError,
  });

  const updateOrderQuery = {
    update: vi.fn(),
    eq: vi.fn(),
  };
  updateOrderQuery.update.mockReturnValue(updateOrderQuery);
  updateOrderQuery.eq.mockResolvedValue({ error: updateOrderError });

  const deleteItemsQuery = {
    delete: vi.fn(),
    eq: vi.fn(),
  };
  deleteItemsQuery.delete.mockReturnValue(deleteItemsQuery);
  deleteItemsQuery.eq.mockResolvedValue({ error: deleteItemsError });

  const insertItemsQuery = {
    insert: vi.fn(),
  };
  insertItemsQuery.insert.mockResolvedValue({ error: insertItemsError });

  const from = vi.fn().mockReturnValueOnce(loadQuery);
  from.mockReturnValueOnce(
    existingOrders.length > 0 ? updateOrderQuery : insertOrderQuery
  );
  from
    .mockReturnValueOnce(deleteItemsQuery)
    .mockReturnValueOnce(insertItemsQuery);

  return {
    supabase: { from } as unknown as SupabaseClient,
    insertOrderQuery,
    updateOrderQuery,
    deleteItemsQuery,
    insertItemsQuery,
  };
}

describe('commitBumpaOrders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createImportCustomerResolver).mockResolvedValue({
      resolveCustomerId: vi.fn().mockResolvedValue({
        customerId: 'customer-1',
        createdCustomer: false,
      }),
    });
  });

  it('creates imported orders and inserts snapshot order items', async () => {
    const { supabase, insertOrderQuery, insertItemsQuery } =
      createSupabaseMock();

    const result = await commitBumpaOrders({
      supabase,
      merchantId: 'merchant-1',
      importJobId: 'job-1',
      orders: [createOrder()],
    });

    expect(result).toEqual({
      createdOrders: 1,
      updatedOrders: 0,
      createdCustomers: 0,
    });
    expect(insertOrderQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'manual',
      })
    );
    expect(insertItemsQuery.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          order_id: 'order-new',
          name: 'Imported Phone',
          quantity: 2,
        }),
      ])
    );
  });

  it('stores rich imported address and product metadata during commit', async () => {
    const { supabase, insertOrderQuery, insertItemsQuery } =
      createSupabaseMock();

    await commitBumpaOrders({
      supabase,
      merchantId: 'merchant-1',
      importJobId: 'job-1',
      orders: [
        createOrder({
          shippingAddress: {
            fullAddress: '10 Marina, Lagos, Nigeria',
            address: null,
            city: 'Marina',
            state: 'Lagos',
            country: 'Nigeria',
            postalCode: '100001',
            source: 'shipping',
          },
          items: [
            {
              productId: null,
              productName: 'Google Pixel 7a 128GB (Premium Used)',
              sku: null,
              quantity: 1,
              unitPrice: 300000,
              lineTotal: 300000,
              matched: false,
              matchSource: 'unmatched',
              importMetadata: {
                bumpa: {
                  analytics_product_key: 'google-pixel-7a-128gb-premium-used',
                  fulfillment_identifiers: {
                    imeis: ['351183326811261'],
                    serialNumbers: ['SN-PIXEL-7A'],
                  },
                },
              },
            },
          ],
        }),
      ],
    });

    expect(insertOrderQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        shipping_address: expect.objectContaining({
          address: '10 Marina, Lagos, Nigeria',
          address_line1: '10 Marina, Lagos, Nigeria',
          full_address: '10 Marina, Lagos, Nigeria',
          city: 'Marina',
          postal_code: '100001',
          source: 'shipping',
        }),
        fulfillment_details: expect.objectContaining({
          shipping_address_source: 'shipping',
        }),
      })
    );
    expect(insertItemsQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        fulfillment_data: expect.objectContaining({
          matched: false,
          imei: '351183326811261',
          serialNumber: 'SN-PIXEL-7A',
          serial_number: 'SN-PIXEL-7A',
          bumpa: {
            analytics_product_key: 'google-pixel-7a-128gb-premium-used',
            fulfillment_identifiers: {
              imeis: ['351183326811261'],
              serialNumbers: ['SN-PIXEL-7A'],
            },
          },
        }),
      }),
    ]);
  });

  it('updates existing imported orders and replaces order_items wholesale', async () => {
    const { supabase, updateOrderQuery, deleteItemsQuery, insertItemsQuery } =
      createSupabaseMock({
        existingOrders: [
          {
            id: 'order-existing',
            external_id: 'ext-1',
            tracking_token: 'tracking-existing',
            fulfillment_details: {
              shipping_address_source: 'previous-rich-import',
            },
          },
        ],
      });

    const result = await commitBumpaOrders({
      supabase,
      merchantId: 'merchant-1',
      importJobId: 'job-1',
      orders: [createOrder()],
    });

    expect(result).toEqual({
      createdOrders: 0,
      updatedOrders: 1,
      createdCustomers: 0,
    });
    expect(updateOrderQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        merchant_id: 'merchant-1',
        payment_status: 'paid',
        shipping_status: 'delivered',
        fulfillment_details: expect.objectContaining({
          shipping_address_source: 'previous-rich-import',
        }),
        import_job_id: 'job-1',
        external_id: 'ext-1',
        source: 'manual',
      })
    );
    const updatePayload = updateOrderQuery.update.mock.calls[0]?.[0];
    expect(updatePayload).not.toHaveProperty('shipping_address');
    expect(deleteItemsQuery.eq).toHaveBeenCalledWith(
      'order_id',
      'order-existing'
    );
    expect(insertItemsQuery.insert).toHaveBeenCalledTimes(1);
  });

  it('preserves existing shipping addresses when an update only has partial enrichment', async () => {
    const { supabase, updateOrderQuery } = createSupabaseMock({
      existingOrders: [
        {
          id: 'order-existing',
          external_id: 'ext-1',
          tracking_token: 'tracking-existing',
          fulfillment_details: {
            shipping_address_source: 'previous-rich-import',
          },
          shipping_address: {
            address: '10 Marina',
            city: 'Marina',
            state: 'Lagos',
          },
        },
      ],
    });

    await commitBumpaOrders({
      supabase,
      merchantId: 'merchant-1',
      importJobId: 'job-1',
      orders: [
        createOrder({
          shippingAddress: {
            fullAddress: '12 Admiralty Way',
            address: null,
            city: null,
            state: null,
            country: 'Nigeria',
            postalCode: null,
            source: 'partial-bumpa-import',
          },
        }),
      ],
    });

    const updatePayload = updateOrderQuery.update.mock.calls[0]?.[0];
    expect(updatePayload).not.toHaveProperty('shipping_address');
    expect(updatePayload).toMatchObject({
      fulfillment_details: expect.objectContaining({
        shipping_address_source: 'previous-rich-import',
      }),
    });
  });

  it('writes a partial incoming address when an existing imported order has no stored address', async () => {
    const { supabase, updateOrderQuery } = createSupabaseMock({
      existingOrders: [
        {
          id: 'order-existing',
          external_id: 'ext-1',
          tracking_token: 'tracking-existing',
          fulfillment_details: null,
          shipping_address: null,
        },
      ],
    });

    await commitBumpaOrders({
      supabase,
      merchantId: 'merchant-1',
      importJobId: 'job-1',
      orders: [
        createOrder({
          shippingAddress: {
            fullAddress: '12 Admiralty Way, Lekki',
            address: null,
            city: null,
            state: null,
            country: 'Nigeria',
            postalCode: null,
            source: 'partial-bumpa-import',
          },
        }),
      ],
    });

    expect(updateOrderQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        shipping_address: expect.objectContaining({
          address: '12 Admiralty Way, Lekki',
          address_line1: '12 Admiralty Way, Lekki',
          full_address: '12 Admiralty Way, Lekki',
        }),
        fulfillment_details: expect.objectContaining({
          shipping_address_source: 'partial-bumpa-import',
        }),
      })
    );
  });

  it('promotes bare numeric Bumpa identifiers into receipt fulfillment data', async () => {
    const { supabase, insertItemsQuery } = createSupabaseMock();

    await commitBumpaOrders({
      supabase,
      merchantId: 'merchant-1',
      importJobId: 'job-1',
      orders: [
        createOrder({
          items: [
            {
              productId: null,
              productName: 'iPhone 12 351183326811261',
              sku: null,
              quantity: 1,
              unitPrice: 300000,
              lineTotal: 300000,
              matched: false,
              matchSource: 'unmatched',
              importMetadata: {
                bumpa: {
                  fulfillment_identifiers: {
                    imeis: [],
                    serialNumbers: [],
                    unlabeledIdentifiers: ['351183326811261'],
                  },
                },
              },
            },
          ],
        }),
      ],
    });

    expect(insertItemsQuery.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        fulfillment_data: expect.objectContaining({
          imei: '351183326811261',
        }),
      }),
    ]);
  });

  it('increments createdCustomers when the importer creates a new customer', async () => {
    vi.mocked(createImportCustomerResolver).mockResolvedValue({
      resolveCustomerId: vi.fn().mockResolvedValue({
        customerId: 'customer-new',
        createdCustomer: true,
      }),
    });

    const { supabase } = createSupabaseMock();

    const result = await commitBumpaOrders({
      supabase,
      merchantId: 'merchant-1',
      importJobId: 'job-1',
      orders: [createOrder()],
    });

    expect(result).toEqual({
      createdOrders: 1,
      updatedOrders: 0,
      createdCustomers: 1,
    });
  });

  it('throws when creating an imported order fails', async () => {
    const { supabase } = createSupabaseMock({
      insertedOrder: null,
      insertOrderError: { message: 'insert failed' },
    });

    await expect(
      commitBumpaOrders({
        supabase,
        merchantId: 'merchant-1',
        importJobId: 'job-1',
        orders: [createOrder()],
      })
    ).rejects.toThrow('Failed to create imported order: insert failed');
  });

  it('throws when replacing imported order items fails', async () => {
    const { supabase } = createSupabaseMock({
      existingOrders: [
        {
          id: 'order-existing',
          external_id: 'ext-1',
          tracking_token: 'tracking-existing',
        },
      ],
      insertItemsError: { message: 'items failed' },
    });

    await expect(
      commitBumpaOrders({
        supabase,
        merchantId: 'merchant-1',
        importJobId: 'job-1',
        orders: [createOrder()],
      })
    ).rejects.toThrow('Failed to insert imported order items: items failed');
  });

  it('maps Bumpa origins to native Baci order sources', async () => {
    const { supabase, insertOrderQuery } = createSupabaseMock({
      insertedOrder: {
        id: 'order-new',
        external_id: 'ext-2',
        tracking_token: 'tracking-2',
      },
    });

    await commitBumpaOrders({
      supabase,
      merchantId: 'merchant-1',
      importJobId: 'job-1',
      orders: [
        createOrder({
          externalSourceId: 'ext-2',
          sourceOrigin: 'walk-in',
          sourceChannel: 'MOBILE',
        }),
      ],
    });

    expect(insertOrderQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'physical',
      })
    );
  });
});
