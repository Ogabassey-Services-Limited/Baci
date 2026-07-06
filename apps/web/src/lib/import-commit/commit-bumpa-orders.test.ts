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
    importMetadata: {
      previewExistingOrderUpdatedAt: '2026-03-21T10:00:00.000Z',
    },
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
  updated_at?: string | null;
  fulfillment_details?: Record<string, unknown> | null;
  shipping_address?: Record<string, unknown> | null;
}

interface CreateSupabaseMockOptions {
  existingOrders?: ExistingOrderFixture[];
  insertedOrder?: ExistingOrderFixture | null;
  insertOrderError?: { message: string } | null;
  replaceOrderItemsError?: { message: string } | null;
  replaceImportedOrderItemsError?: { message: string } | null;
  cleanupOrderError?: { message: string } | null;
  cleanupDeletedOrder?: { id: string } | null;
}

function createSupabaseMock({
  existingOrders = [],
  insertedOrder = {
    id: 'order-new',
    external_id: 'ext-1',
    tracking_token: 'tracking-1',
    updated_at: '2026-03-21T10:00:00.000Z',
    fulfillment_details: null,
    shipping_address: null,
  },
  insertOrderError = null,
  replaceOrderItemsError = null,
  replaceImportedOrderItemsError = null,
  cleanupOrderError = null,
  cleanupDeletedOrder = { id: 'order-new' },
}: CreateSupabaseMockOptions = {}) {
  let updatedAtTick = 0;

  function compactJsonObject(
    incoming: unknown,
    { stripNulls = false }: { stripNulls?: boolean } = {}
  ): Record<string, unknown> | null | undefined {
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      return null;
    }

    return stripNulls
      ? Object.fromEntries(
          Object.entries(incoming).filter(([, value]) => value !== null)
        )
      : (incoming as Record<string, unknown>);
  }

  function mergeJsonObject(
    current: Record<string, unknown> | null | undefined,
    incoming: unknown
  ): Record<string, unknown> | null | undefined {
    const compactIncoming = compactJsonObject(incoming);
    if (!compactIncoming) return current;

    return {
      ...(current ?? {}),
      ...compactIncoming,
    };
  }

  function nextUpdatedAt(previous: string | null | undefined) {
    const base = previous
      ? Date.parse(previous)
      : Date.parse('2026-03-21T10:00:00.000Z');
    updatedAtTick += 1;
    return new Date(base + updatedAtTick).toISOString();
  }

  function updatedOrderFromRpcArgs(args: Record<string, unknown>) {
    const orderId = typeof args.p_order_id === 'string' ? args.p_order_id : '';
    const patch =
      args.p_order_patch &&
      typeof args.p_order_patch === 'object' &&
      !Array.isArray(args.p_order_patch)
        ? (args.p_order_patch as Record<string, unknown>)
        : {};
    const order =
      existingOrders.find((candidate) => candidate.id === orderId) ||
      (insertedOrder?.id === orderId ? insertedOrder : null);

    if (!order) return null;

    return {
      ...order,
      external_id:
        typeof patch.external_id === 'string'
          ? patch.external_id
          : order.external_id,
      tracking_token:
        typeof patch.tracking_token === 'string'
          ? patch.tracking_token
          : order.tracking_token,
      updated_at: nextUpdatedAt(order.updated_at),
      fulfillment_details:
        'fulfillment_details' in patch
          ? mergeJsonObject(
              order.fulfillment_details,
              patch.fulfillment_details
            )
          : order.fulfillment_details,
      shipping_address:
        'shipping_address' in patch
          ? compactJsonObject(patch.shipping_address, {
              stripNulls: true,
            })
          : order.shipping_address,
    };
  }

  const loadQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
  };
  loadQuery.select.mockReturnValue(loadQuery);
  loadQuery.eq.mockReturnValue(loadQuery);
  loadQuery.in.mockReturnValue(loadQuery);
  loadQuery.order.mockReturnValue(loadQuery);
  loadQuery.range.mockResolvedValue({ data: existingOrders, error: null });

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

  const deleteOrderQuery = {
    delete: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(),
  };
  deleteOrderQuery.delete.mockReturnValue(deleteOrderQuery);
  deleteOrderQuery.eq.mockReturnValue(deleteOrderQuery);
  deleteOrderQuery.select.mockReturnValue(deleteOrderQuery);
  deleteOrderQuery.maybeSingle.mockResolvedValue({
    data: cleanupOrderError ? null : cleanupDeletedOrder,
    error: cleanupOrderError,
  });

  const ordersTable = {
    select: loadQuery.select,
    insert: insertOrderQuery.insert,
    delete: deleteOrderQuery.delete,
  };
  const from = vi.fn((tableName: string) => {
    if (tableName === 'orders') return ordersTable;
    throw new Error(`Unexpected table: ${tableName}`);
  });
  const rpc = vi.fn((functionName: string, args: Record<string, unknown>) => {
    if (functionName === 'replace_order_items') {
      return Promise.resolve({ error: replaceOrderItemsError });
    }

    if (functionName === 'replace_imported_order_items') {
      const updatedOrder = updatedOrderFromRpcArgs(args);

      return Promise.resolve({
        data: updatedOrder ? [updatedOrder] : [],
        error: replaceImportedOrderItemsError,
      });
    }

    throw new Error(`Unexpected rpc: ${functionName}`);
  });

  return {
    supabase: { from, rpc } as unknown as SupabaseClient,
    loadQuery,
    insertOrderQuery,
    deleteOrderQuery,
    rpc,
  };
}

function getReplaceImportedOrderItemsArgs(rpc: ReturnType<typeof vi.fn>) {
  const call = rpc.mock.calls.find(
    ([functionName]) => functionName === 'replace_imported_order_items'
  );

  if (!call) {
    throw new Error('replace_imported_order_items was not called');
  }

  return call[1] as {
    p_order_id: string;
    p_items: Record<string, unknown>[];
    p_merchant_id: string;
    p_order_patch: Record<string, unknown>;
    p_expected_updated_at: string | null;
  };
}

function getReplaceOrderItemsArgs(rpc: ReturnType<typeof vi.fn>) {
  const call = rpc.mock.calls.find(
    ([functionName]) => functionName === 'replace_order_items'
  );

  if (!call) {
    throw new Error('replace_order_items was not called');
  }

  return call[1] as {
    p_order_id: string;
    p_items: Record<string, unknown>[];
    p_merchant_id: string;
    p_is_import?: boolean;
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
    const { supabase, insertOrderQuery, rpc } = createSupabaseMock();

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
    expect(rpc).toHaveBeenCalledWith('replace_order_items', {
      p_order_id: 'order-new',
      p_items: expect.arrayContaining([
        expect.objectContaining({
          order_id: 'order-new',
          name: 'Imported Phone',
          quantity: 2,
        }),
      ]),
      p_merchant_id: 'merchant-1',
      p_is_import: true,
    });
  });

  it('reports commit progress after each created or updated order', async () => {
    const onProgress = vi.fn();
    const { supabase } = createSupabaseMock({
      existingOrders: [
        {
          id: 'order-existing',
          external_id: 'ext-2',
          tracking_token: 'tracking-existing',
          updated_at: '2026-03-21T10:00:00.000Z',
          fulfillment_details: null,
          shipping_address: null,
        },
      ],
    });

    const result = await commitBumpaOrders({
      supabase,
      merchantId: 'merchant-1',
      importJobId: 'job-1',
      orders: [
        createOrder({ externalSourceId: 'ext-1' }),
        createOrder({
          externalSourceId: 'ext-2',
          orderNumber: 'ORD-1002',
        }),
      ],
      onProgress,
    });

    expect(result).toMatchObject({
      createdOrders: 1,
      updatedOrders: 1,
    });
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, {
      processedRecords: 1,
      totalRecords: 2,
    });
    expect(onProgress).toHaveBeenNthCalledWith(2, {
      processedRecords: 2,
      totalRecords: 2,
    });
  });

  it('preserves rounded imported line totals and item timestamps for new orders', async () => {
    const { supabase, rpc } = createSupabaseMock();

    await commitBumpaOrders({
      supabase,
      merchantId: 'merchant-1',
      importJobId: 'job-1',
      orders: [
        createOrder({
          createdAt: '2022-03-20T10:00:00.000Z',
          items: [
            {
              productId: null,
              productName: 'Imported Rounded Bundle',
              sku: null,
              quantity: 3,
              unitPrice: 333.33,
              lineTotal: 1000,
              matched: false,
              matchSource: 'unmatched',
            },
          ],
        }),
      ],
    });

    expect(getReplaceOrderItemsArgs(rpc)).toMatchObject({
      p_order_id: 'order-new',
      p_merchant_id: 'merchant-1',
      p_is_import: true,
      p_items: [
        expect.objectContaining({
          price: 333.33,
          quantity: 3,
          line_extension_amount: 1000,
          created_at: '2022-03-20T10:00:00.000Z',
        }),
      ],
    });
  });

  it('stores rich imported address and product metadata during commit', async () => {
    const { supabase, insertOrderQuery, rpc } = createSupabaseMock();

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
    expect(rpc).toHaveBeenCalledWith('replace_order_items', {
      p_order_id: 'order-new',
      p_items: [
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
      ],
      p_merchant_id: 'merchant-1',
      p_is_import: true,
    });
  });

  it('updates existing imported orders and replaces order_items wholesale', async () => {
    const { supabase, rpc } = createSupabaseMock({
      existingOrders: [
        {
          id: 'order-existing',
          external_id: 'ext-1',
          tracking_token: 'tracking-existing',
          updated_at: '2026-03-21T10:00:00.000Z',
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
    const rpcArgs = getReplaceImportedOrderItemsArgs(rpc);
    expect(rpcArgs).toMatchObject({
      p_order_id: 'order-existing',
      p_merchant_id: 'merchant-1',
      p_expected_updated_at: '2026-03-21T10:00:00.000Z',
      p_items: expect.arrayContaining([
        expect.objectContaining({ order_id: 'order-existing' }),
      ]),
      p_order_patch: expect.objectContaining({
        merchant_id: 'merchant-1',
        payment_status: 'paid',
        shipping_status: 'delivered',
        fulfillment_details: expect.objectContaining({
          shipping_option: 'Door delivery',
          source_channel: 'instagram',
          source_origin: 'manual',
        }),
        import_job_id: 'job-1',
        external_id: 'ext-1',
        source: 'manual',
      }),
    });
    expect(rpcArgs.p_order_patch).not.toHaveProperty('shipping_address');
    expect(rpcArgs.p_order_patch.fulfillment_details).not.toHaveProperty(
      'shipping_address_source'
    );
    expect(rpcArgs.p_order_patch.import_metadata).not.toHaveProperty(
      'previewExistingOrderUpdatedAt'
    );
  });

  it('targets existing imported order lookups to incoming external ids in chunks', async () => {
    const existingOrders = Array.from({ length: 151 }, (_value, index) => ({
      external_id: `ext-${index + 1}`,
      id: `order-existing-${index + 1}`,
      tracking_token: `tracking-existing-${index + 1}`,
      updated_at: '2026-03-21T10:00:00.000Z',
    }));
    const { loadQuery, supabase } = createSupabaseMock({ existingOrders });

    await commitBumpaOrders({
      supabase,
      merchantId: 'merchant-1',
      importJobId: 'job-1',
      orders: existingOrders.map((order, index) =>
        createOrder({
          externalSourceId: order.external_id ?? '',
          orderNumber: `ORD-${index + 1}`,
        })
      ),
    });

    const lookupValueLengths = loadQuery.in.mock.calls.map(
      ([_field, values]) => values.length
    );
    expect(loadQuery.in).toHaveBeenCalledWith(
      'external_id',
      expect.arrayContaining(['ext-1'])
    );
    expect(lookupValueLengths).toEqual([150, 1]);
    expect(loadQuery.order).toHaveBeenCalledWith('id');
    expect(loadQuery.range).toHaveBeenCalledWith(0, 999);
  });

  it('uses preview-time updated_at for imported order stale checks', async () => {
    const { supabase, rpc } = createSupabaseMock({
      existingOrders: [
        {
          id: 'order-existing',
          external_id: 'ext-1',
          tracking_token: 'tracking-existing',
          updated_at: '2026-03-22T10:00:00.000Z',
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
          importMetadata: {
            previewExistingOrderUpdatedAt: '2026-03-21T10:00:00.000Z',
          },
        }),
      ],
    });

    expect(getReplaceImportedOrderItemsArgs(rpc).p_expected_updated_at).toBe(
      '2026-03-21T10:00:00.000Z'
    );
  });

  it('requires update rows to come from a fresh preview with an updated_at marker', async () => {
    const { supabase } = createSupabaseMock({
      existingOrders: [
        {
          id: 'order-existing',
          external_id: 'ext-1',
          tracking_token: 'tracking-existing',
          updated_at: '2026-03-22T10:00:00.000Z',
          fulfillment_details: null,
          shipping_address: null,
        },
      ],
    });

    await expect(
      commitBumpaOrders({
        supabase,
        merchantId: 'merchant-1',
        importJobId: 'job-1',
        orders: [
          createOrder({
            importMetadata: {},
          }),
        ],
      })
    ).rejects.toThrow('missing its preview timestamp');
  });

  it('sends explicit null fulfillment fields so re-imports clear stale values', async () => {
    const { supabase, rpc } = createSupabaseMock({
      existingOrders: [
        {
          id: 'order-existing',
          external_id: 'ext-1',
          tracking_token: 'tracking-existing',
          updated_at: '2026-03-22T10:00:00.000Z',
          fulfillment_details: {
            shipping_option: 'Old option',
            source_channel: 'old-channel',
            source_origin: 'old-origin',
          },
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
          shippingOption: null,
          sourceChannel: null,
          sourceOrigin: null,
          importMetadata: {
            previewExistingOrderUpdatedAt: '2026-03-22T10:00:00.000Z',
          },
        }),
      ],
    });

    const rpcArgs = getReplaceImportedOrderItemsArgs(rpc);
    expect(rpcArgs.p_order_patch.fulfillment_details).toEqual({
      shipping_option: null,
      source_channel: null,
      source_origin: null,
    });
  });

  it('preserves existing shipping addresses when an update only has partial enrichment', async () => {
    const { supabase, rpc } = createSupabaseMock({
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

    const rpcArgs = getReplaceImportedOrderItemsArgs(rpc);
    expect(rpcArgs.p_order_patch).not.toHaveProperty('shipping_address');
    expect(rpcArgs.p_order_patch.fulfillment_details).not.toHaveProperty(
      'shipping_address_source'
    );
  });

  it('merges complete incoming addresses with richer existing address fields', async () => {
    const { supabase, rpc } = createSupabaseMock({
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
            address_line1: '10 Marina',
            full_address: '10 Marina, Lagos, Nigeria',
            city: 'Marina',
            state: 'Lagos',
            country: 'Nigeria',
            postal_code: '100001',
            source: 'previous-rich-import',
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
            fullAddress: null,
            address: '12 Admiralty Way',
            city: 'Lekki',
            state: 'Lagos',
            country: null,
            postalCode: null,
            source: 'shipping',
          },
        }),
      ],
    });

    const rpcArgs = getReplaceImportedOrderItemsArgs(rpc);
    expect(rpcArgs.p_order_patch).toMatchObject({
      shipping_address: {
        address: '12 Admiralty Way',
        address_line1: '12 Admiralty Way',
        city: 'Lekki',
        state: 'Lagos',
        source: 'shipping',
      },
    });
    expect(rpcArgs.p_order_patch.shipping_address).not.toHaveProperty(
      'full_address'
    );
    expect(rpcArgs.p_order_patch.shipping_address).not.toHaveProperty(
      'country'
    );
    expect(rpcArgs.p_order_patch.shipping_address).not.toHaveProperty(
      'postal_code'
    );
  });

  it('caches inserted orders with merge fields for duplicate orders in the same batch', async () => {
    const { supabase, insertOrderQuery, rpc } = createSupabaseMock({
      insertedOrder: {
        id: 'order-new',
        external_id: 'ext-1',
        tracking_token: 'tracking-1',
        fulfillment_details: null,
        shipping_address: {
          address: '10 Marina',
          address_line1: '10 Marina',
          full_address: '10 Marina, Lagos, Nigeria',
          city: 'Marina',
          state: 'Lagos',
          country: 'Nigeria',
          postal_code: '100001',
          source: 'shipping',
        },
      },
    });

    await commitBumpaOrders({
      supabase,
      merchantId: 'merchant-1',
      importJobId: 'job-1',
      orders: [
        createOrder({
          shippingAddress: {
            fullAddress: '10 Marina, Lagos, Nigeria',
            address: '10 Marina',
            city: 'Marina',
            state: 'Lagos',
            country: 'Nigeria',
            postalCode: '100001',
            source: 'shipping',
          },
        }),
        createOrder({
          shippingAddress: {
            fullAddress: null,
            address: '12 Admiralty Way',
            city: 'Lekki',
            state: 'Lagos',
            country: null,
            postalCode: null,
            source: 'shipping',
          },
        }),
      ],
    });

    expect(insertOrderQuery.insert).toHaveBeenCalledTimes(1);
    const rpcArgs = getReplaceImportedOrderItemsArgs(rpc);
    expect(rpcArgs.p_order_patch).toMatchObject({
      shipping_address: expect.objectContaining({
        address: '12 Admiralty Way',
        city: 'Lekki',
        state: 'Lagos',
      }),
    });
    expect(rpcArgs.p_order_patch.shipping_address).not.toHaveProperty(
      'full_address'
    );
    expect(rpcArgs.p_order_patch.shipping_address).not.toHaveProperty(
      'country'
    );
    expect(rpcArgs.p_order_patch.shipping_address).not.toHaveProperty(
      'postal_code'
    );
  });

  it('writes a partial incoming address when an existing imported order has no stored address', async () => {
    const { supabase, rpc } = createSupabaseMock({
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

    expect(getReplaceImportedOrderItemsArgs(rpc).p_order_patch).toMatchObject({
      shipping_address: expect.objectContaining({
        address: '12 Admiralty Way, Lekki',
        address_line1: '12 Admiralty Way, Lekki',
        full_address: '12 Admiralty Way, Lekki',
      }),
      fulfillment_details: expect.objectContaining({
        shipping_address_source: 'partial-bumpa-import',
      }),
    });
  });

  it('treats incomplete stored addresses as missing when incoming Bumpa address is printable', async () => {
    const { supabase, rpc } = createSupabaseMock({
      existingOrders: [
        {
          id: 'order-existing',
          external_id: 'ext-1',
          tracking_token: 'tracking-existing',
          fulfillment_details: null,
          shipping_address: {
            city: 'Old City',
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

    expect(getReplaceImportedOrderItemsArgs(rpc).p_order_patch).toMatchObject({
      shipping_address: expect.objectContaining({
        address: '12 Admiralty Way, Lekki',
        address_line1: '12 Admiralty Way, Lekki',
        full_address: '12 Admiralty Way, Lekki',
      }),
      fulfillment_details: expect.objectContaining({
        shipping_address_source: 'partial-bumpa-import',
      }),
    });
  });

  it('writes location-only incoming address data when no stored address exists', async () => {
    const { supabase, rpc } = createSupabaseMock({
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
            fullAddress: null,
            address: null,
            city: 'Lekki',
            state: 'Lagos',
            country: 'Nigeria',
            postalCode: null,
            source: 'location-only-bumpa-import',
          },
        }),
      ],
    });

    expect(getReplaceImportedOrderItemsArgs(rpc).p_order_patch).toMatchObject({
      shipping_address: expect.objectContaining({
        city: 'Lekki',
        state: 'Lagos',
        country: 'Nigeria',
        source: 'location-only-bumpa-import',
      }),
      fulfillment_details: expect.objectContaining({
        shipping_address_source: 'location-only-bumpa-import',
      }),
    });
  });

  it('drops whitespace-only incoming address fields', async () => {
    const { supabase, rpc } = createSupabaseMock({
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
            fullAddress: '   ',
            address: '   ',
            city: '   ',
            state: '   ',
            country: '   ',
            postalCode: '   ',
            source: '   ',
          },
        }),
      ],
    });

    const rpcArgs = getReplaceImportedOrderItemsArgs(rpc);
    expect(rpcArgs.p_order_patch).not.toHaveProperty('shipping_address');
    expect(rpcArgs.p_order_patch.fulfillment_details).not.toHaveProperty(
      'shipping_address_source'
    );
  });

  it('promotes bare numeric Bumpa identifiers into receipt fulfillment data', async () => {
    const { supabase, rpc } = createSupabaseMock();

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

    expect(rpc).toHaveBeenCalledWith('replace_order_items', {
      p_order_id: 'order-new',
      p_items: [
        expect.objectContaining({
          fulfillment_data: expect.objectContaining({
            imei: '351183326811261',
          }),
        }),
      ],
      p_merchant_id: 'merchant-1',
      p_is_import: true,
    });
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

  it('throws when atomically updating an existing imported order fails', async () => {
    const { supabase } = createSupabaseMock({
      existingOrders: [
        {
          id: 'order-existing',
          external_id: 'ext-1',
          tracking_token: 'tracking-existing',
        },
      ],
      replaceImportedOrderItemsError: { message: 'items failed' },
    });

    await expect(
      commitBumpaOrders({
        supabase,
        merchantId: 'merchant-1',
        importJobId: 'job-1',
        orders: [createOrder()],
      })
    ).rejects.toThrow('Failed to update imported order: items failed');
  });

  it('deletes a newly created order with merchant scope when item replacement fails', async () => {
    const { supabase, deleteOrderQuery } = createSupabaseMock({
      replaceOrderItemsError: { message: 'items failed' },
    });

    await expect(
      commitBumpaOrders({
        supabase,
        merchantId: 'merchant-1',
        importJobId: 'job-1',
        orders: [createOrder()],
      })
    ).rejects.toThrow('Failed to replace imported order items: items failed');

    expect(deleteOrderQuery.eq).toHaveBeenCalledWith('id', 'order-new');
    expect(deleteOrderQuery.eq).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-1'
    );
    expect(deleteOrderQuery.select).toHaveBeenCalledWith('id');
    expect(deleteOrderQuery.maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('throws when cleanup delete does not remove the incomplete order', async () => {
    const { supabase } = createSupabaseMock({
      replaceOrderItemsError: { message: 'items failed' },
      cleanupDeletedOrder: null,
    });

    await expect(
      commitBumpaOrders({
        supabase,
        merchantId: 'merchant-1',
        importJobId: 'job-1',
        orders: [createOrder()],
      })
    ).rejects.toThrow(
      'also failed to delete incomplete imported order order-new: no matching row was deleted'
    );
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
