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
    const loadQuery = {
      select: vi.fn(),
      eq: vi.fn(),
    };
    loadQuery.select.mockReturnValue(loadQuery);
    loadQuery.eq
      .mockReturnValueOnce(loadQuery)
      .mockResolvedValueOnce({ data: [], error: null });

    const insertOrderQuery = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    insertOrderQuery.insert.mockReturnValue(insertOrderQuery);
    insertOrderQuery.select.mockReturnValue(insertOrderQuery);
    insertOrderQuery.single.mockResolvedValue({
      data: {
        id: 'order-new',
        external_id: 'ext-1',
        tracking_token: 'tracking-1',
      },
      error: null,
    });

    const deleteItemsQuery = {
      delete: vi.fn(),
      eq: vi.fn(),
    };
    deleteItemsQuery.delete.mockReturnValue(deleteItemsQuery);
    deleteItemsQuery.eq.mockResolvedValue({ error: null });

    const insertItemsQuery = {
      insert: vi.fn(),
    };
    insertItemsQuery.insert.mockResolvedValue({ error: null });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(loadQuery)
        .mockReturnValueOnce(insertOrderQuery)
        .mockReturnValueOnce(deleteItemsQuery)
        .mockReturnValueOnce(insertItemsQuery),
    } as unknown as SupabaseClient;

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

  it('updates existing imported orders and replaces order_items wholesale', async () => {
    const loadQuery = {
      select: vi.fn(),
      eq: vi.fn(),
    };
    loadQuery.select.mockReturnValue(loadQuery);
    loadQuery.eq.mockReturnValueOnce(loadQuery).mockResolvedValueOnce({
      data: [
        {
          id: 'order-existing',
          external_id: 'ext-1',
          tracking_token: 'tracking-existing',
        },
      ],
      error: null,
    });

    const updateOrderQuery = {
      update: vi.fn(),
      eq: vi.fn(),
    };
    updateOrderQuery.update.mockReturnValue(updateOrderQuery);
    updateOrderQuery.eq.mockResolvedValue({ error: null });

    const deleteItemsQuery = {
      delete: vi.fn(),
      eq: vi.fn(),
    };
    deleteItemsQuery.delete.mockReturnValue(deleteItemsQuery);
    deleteItemsQuery.eq.mockResolvedValue({ error: null });

    const insertItemsQuery = {
      insert: vi.fn(),
    };
    insertItemsQuery.insert.mockResolvedValue({ error: null });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(loadQuery)
        .mockReturnValueOnce(updateOrderQuery)
        .mockReturnValueOnce(deleteItemsQuery)
        .mockReturnValueOnce(insertItemsQuery),
    } as unknown as SupabaseClient;

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
        import_job_id: 'job-1',
        external_id: 'ext-1',
        source: 'manual',
      })
    );
    expect(deleteItemsQuery.eq).toHaveBeenCalledWith(
      'order_id',
      'order-existing'
    );
    expect(insertItemsQuery.insert).toHaveBeenCalledTimes(1);
  });

  it('increments createdCustomers when the importer creates a new customer', async () => {
    vi.mocked(createImportCustomerResolver).mockResolvedValue({
      resolveCustomerId: vi.fn().mockResolvedValue({
        customerId: 'customer-new',
        createdCustomer: true,
      }),
    });

    const loadQuery = {
      select: vi.fn(),
      eq: vi.fn(),
    };
    loadQuery.select.mockReturnValue(loadQuery);
    loadQuery.eq
      .mockReturnValueOnce(loadQuery)
      .mockResolvedValueOnce({ data: [], error: null });

    const insertOrderQuery = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    insertOrderQuery.insert.mockReturnValue(insertOrderQuery);
    insertOrderQuery.select.mockReturnValue(insertOrderQuery);
    insertOrderQuery.single.mockResolvedValue({
      data: {
        id: 'order-new',
        external_id: 'ext-1',
        tracking_token: 'tracking-1',
      },
      error: null,
    });

    const deleteItemsQuery = {
      delete: vi.fn(),
      eq: vi.fn(),
    };
    deleteItemsQuery.delete.mockReturnValue(deleteItemsQuery);
    deleteItemsQuery.eq.mockResolvedValue({ error: null });

    const insertItemsQuery = {
      insert: vi.fn(),
    };
    insertItemsQuery.insert.mockResolvedValue({ error: null });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(loadQuery)
        .mockReturnValueOnce(insertOrderQuery)
        .mockReturnValueOnce(deleteItemsQuery)
        .mockReturnValueOnce(insertItemsQuery),
    } as unknown as SupabaseClient;

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
    const loadQuery = {
      select: vi.fn(),
      eq: vi.fn(),
    };
    loadQuery.select.mockReturnValue(loadQuery);
    loadQuery.eq
      .mockReturnValueOnce(loadQuery)
      .mockResolvedValueOnce({ data: [], error: null });

    const insertOrderQuery = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    insertOrderQuery.insert.mockReturnValue(insertOrderQuery);
    insertOrderQuery.select.mockReturnValue(insertOrderQuery);
    insertOrderQuery.single.mockResolvedValue({
      data: null,
      error: { message: 'insert failed' },
    });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(loadQuery)
        .mockReturnValueOnce(insertOrderQuery),
    } as unknown as SupabaseClient;

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
    const loadQuery = {
      select: vi.fn(),
      eq: vi.fn(),
    };
    loadQuery.select.mockReturnValue(loadQuery);
    loadQuery.eq.mockReturnValueOnce(loadQuery).mockResolvedValueOnce({
      data: [
        {
          id: 'order-existing',
          external_id: 'ext-1',
          tracking_token: 'tracking-existing',
        },
      ],
      error: null,
    });

    const updateOrderQuery = {
      update: vi.fn(),
      eq: vi.fn(),
    };
    updateOrderQuery.update.mockReturnValue(updateOrderQuery);
    updateOrderQuery.eq.mockResolvedValue({ error: null });

    const deleteItemsQuery = {
      delete: vi.fn(),
      eq: vi.fn(),
    };
    deleteItemsQuery.delete.mockReturnValue(deleteItemsQuery);
    deleteItemsQuery.eq.mockResolvedValue({ error: null });

    const insertItemsQuery = {
      insert: vi.fn(),
    };
    insertItemsQuery.insert.mockResolvedValue({
      error: { message: 'items failed' },
    });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(loadQuery)
        .mockReturnValueOnce(updateOrderQuery)
        .mockReturnValueOnce(deleteItemsQuery)
        .mockReturnValueOnce(insertItemsQuery),
    } as unknown as SupabaseClient;

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
    const loadQuery = {
      select: vi.fn(),
      eq: vi.fn(),
    };
    loadQuery.select.mockReturnValue(loadQuery);
    loadQuery.eq
      .mockReturnValueOnce(loadQuery)
      .mockResolvedValueOnce({ data: [], error: null });

    const insertOrderQuery = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    insertOrderQuery.insert.mockReturnValue(insertOrderQuery);
    insertOrderQuery.select.mockReturnValue(insertOrderQuery);
    insertOrderQuery.single.mockResolvedValue({
      data: {
        id: 'order-new',
        external_id: 'ext-2',
        tracking_token: 'tracking-2',
      },
      error: null,
    });

    const deleteItemsQuery = {
      delete: vi.fn(),
      eq: vi.fn(),
    };
    deleteItemsQuery.delete.mockReturnValue(deleteItemsQuery);
    deleteItemsQuery.eq.mockResolvedValue({ error: null });

    const insertItemsQuery = {
      insert: vi.fn(),
    };
    insertItemsQuery.insert.mockResolvedValue({ error: null });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(loadQuery)
        .mockReturnValueOnce(insertOrderQuery)
        .mockReturnValueOnce(deleteItemsQuery)
        .mockReturnValueOnce(insertItemsQuery),
    } as unknown as SupabaseClient;

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
