import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ensurePaidOrderInventoryConfirmed,
  isSerializedInventoryUnavailableError,
  rollbackOrderStatusAfterInventoryConfirmationFailure,
} from '@/lib/payments/ensure-paid-order-inventory-confirmed';

const mockRevalidateProducts = vi.fn();
const mockRevalidateProductSlugs = vi.fn();
const mockScheduleStorefrontInventoryProductPurge = vi.fn();
vi.mock('@/lib/cache-revalidation', () => ({
  revalidateProducts: (...args: unknown[]) => mockRevalidateProducts(...args),
  revalidateProductSlugs: (...args: unknown[]) =>
    mockRevalidateProductSlugs(...args),
}));
vi.mock('@/lib/storefront-inventory-product-purge', () => ({
  scheduleStorefrontInventoryProductPurge: (...args: unknown[]) =>
    mockScheduleStorefrontInventoryProductPurge(...args),
}));

interface MockSupabaseRpcClient {
  from?: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
}

interface MockOrderRollbackClient {
  from: ReturnType<typeof vi.fn>;
}

function asSupabaseClient<T extends object>(client: T) {
  return client as Parameters<typeof ensurePaidOrderInventoryConfirmed>[0];
}

function createRollbackBuilder(error: { message: string } | null) {
  const builder: {
    eq: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
  } = {
    eq: vi.fn(() => builder),
    select: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve({ data: { id: 'order-123' }, error })),
  };

  return builder;
}

function createRollbackMissingRowBuilder() {
  const builder: {
    eq: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
  } = {
    eq: vi.fn(() => builder),
    select: vi.fn(() => builder),
    single: vi.fn(() =>
      Promise.resolve({
        data: null,
        error: {
          message: 'JSON object requested, multiple (or no) rows returned',
        },
      })
    ),
  };

  return builder;
}

function createReclaimedInventorySupabase(mockRpc: ReturnType<typeof vi.fn>) {
  const orderItemsEq = vi.fn().mockResolvedValue({
    data: [{ product_id: 'product-1' }],
    error: null,
  });
  const productsIn = vi.fn().mockResolvedValue({
    data: [
      {
        category: 'Smartphones',
        id: 'product-1',
        slug: 'iphone-15',
      },
    ],
    error: null,
  });
  return {
    from: vi.fn((table: string) => {
      if (table === 'order_items') {
        return { select: vi.fn(() => ({ eq: orderItemsEq })) };
      }
      if (table === 'products') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ in: productsIn })),
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
    rpc: mockRpc,
  };
}

describe('ensurePaidOrderInventoryConfirmed', () => {
  beforeEach(() => {
    mockRevalidateProducts.mockReset();
    mockRevalidateProductSlugs.mockReset();
    mockScheduleStorefrontInventoryProductPurge.mockReset();
  });

  it('succeeds without throwing when RPC returns no exception codes', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        alreadyConfirmed: 1,
        confirmedUnitCount: 0,
        reclaimedUnitCount: 0,
        missingUnitCount: 0,
        exceptionCodes: [],
      },
      error: null,
    });

    const mockSupabase: MockSupabaseRpcClient = {
      rpc: mockRpc,
    };

    await expect(
      ensurePaidOrderInventoryConfirmed(
        asSupabaseClient(mockSupabase),
        'merchant-123',
        'order-123'
      )
    ).resolves.not.toThrow();

    expect(mockRpc).toHaveBeenCalledWith(
      'confirm_order_inventory_reservations',
      {
        p_merchant_id: 'merchant-123',
        p_order_id: 'order-123',
      }
    );
    // reclaimedUnitCount 0 means confirmation left stock unchanged — no cache
    // churn needed on every no-op paid-order webhook.
    expect(mockRevalidateProducts).not.toHaveBeenCalled();
  });

  it('throws a database RPC error if the RPC call fails', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Database connection failed' },
    });

    const mockSupabase: MockSupabaseRpcClient = {
      rpc: mockRpc,
    };

    await expect(
      ensurePaidOrderInventoryConfirmed(
        asSupabaseClient(mockSupabase),
        'merchant-123',
        'order-123'
      )
    ).rejects.toThrow('Inventory confirmation failed');

    expect(mockRevalidateProducts).not.toHaveBeenCalled();
  });

  it('throws a custom error if exceptionCodes has elements', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        alreadyConfirmed: 0,
        confirmedUnitCount: 0,
        reclaimedUnitCount: 0,
        missingUnitCount: 1,
        exceptionCodes: [
          { itemId: 'item-123', code: 'late_payment_reservation_lost' },
        ],
      },
      error: null,
    });

    const mockSupabase: MockSupabaseRpcClient = {
      rpc: mockRpc,
    };

    await expect(
      ensurePaidOrderInventoryConfirmed(
        asSupabaseClient(mockSupabase),
        'merchant-123',
        'order-123'
      )
    ).rejects.toThrow('serialized_inventory_unavailable');

    try {
      await ensurePaidOrderInventoryConfirmed(
        asSupabaseClient(mockSupabase),
        'merchant-123',
        'order-123'
      );
    } catch (error) {
      expect(isSerializedInventoryUnavailableError(error)).toBe(true);
    }

    // No re-claim happened (reclaimedUnitCount: 0) — the exception is a
    // missing-unit failure, not a stock-changing re-claim.
    expect(mockRevalidateProducts).not.toHaveBeenCalled();
  });

  it('revalidates product caches when a reservation is re-claimed', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        alreadyConfirmed: 0,
        confirmedUnitCount: 0,
        reclaimedUnitCount: 1,
        missingUnitCount: 0,
        exceptionCodes: [],
      },
      error: null,
    });

    const mockSupabase = createReclaimedInventorySupabase(mockRpc);

    await ensurePaidOrderInventoryConfirmed(
      asSupabaseClient(mockSupabase),
      'merchant-123',
      'order-123'
    );

    expect(mockRevalidateProducts).toHaveBeenCalledExactlyOnceWith(
      'merchant-123'
    );
    expect(mockRevalidateProductSlugs).toHaveBeenCalledExactlyOnceWith(
      'merchant-123',
      ['iphone-15']
    );
    expect(mockScheduleStorefrontInventoryProductPurge).toHaveBeenCalledWith(
      expect.objectContaining({
        merchantId: 'merchant-123',
        operation: 'paid inventory reclaim',
        products: [
          expect.objectContaining({
            category: 'Smartphones',
            id: 'product-1',
            slug: 'iphone-15',
          }),
        ],
        supabase: mockSupabase,
      })
    );
  });

  it('revalidates product caches AND still rejects when a re-claim is followed by an exception on a different item', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        alreadyConfirmed: 0,
        confirmedUnitCount: 0,
        reclaimedUnitCount: 1,
        missingUnitCount: 1,
        exceptionCodes: [
          { itemId: 'item-456', code: 'late_payment_reservation_lost' },
        ],
      },
      error: null,
    });

    const mockSupabase = createReclaimedInventorySupabase(mockRpc);

    // The re-claim already committed via the RPC even though a different
    // item's exception makes this call reject — caches must still be busted.
    await expect(
      ensurePaidOrderInventoryConfirmed(
        asSupabaseClient(mockSupabase),
        'merchant-123',
        'order-123'
      )
    ).rejects.toThrow('serialized_inventory_unavailable');

    expect(mockRevalidateProducts).toHaveBeenCalledExactlyOnceWith(
      'merchant-123'
    );
    expect(mockRevalidateProductSlugs).toHaveBeenCalledExactlyOnceWith(
      'merchant-123',
      ['iphone-15']
    );
    expect(mockScheduleStorefrontInventoryProductPurge).toHaveBeenCalledOnce();
  });

  it('does not throw when revalidateProducts itself throws', async () => {
    mockRevalidateProducts.mockImplementationOnce(() => {
      throw new Error('revalidate boom');
    });
    const mockRpc = vi.fn().mockResolvedValue({
      data: {
        alreadyConfirmed: 0,
        confirmedUnitCount: 0,
        reclaimedUnitCount: 1,
        missingUnitCount: 0,
        exceptionCodes: [],
      },
      error: null,
    });

    const mockSupabase: MockSupabaseRpcClient = {
      rpc: mockRpc,
    };

    await expect(
      ensurePaidOrderInventoryConfirmed(
        asSupabaseClient(mockSupabase),
        'merchant-123',
        'order-123'
      )
    ).resolves.not.toThrow();
  });
});

describe('rollbackOrderStatusAfterInventoryConfirmationFailure', () => {
  it('restores the prior order payment and shipping statuses', async () => {
    const rollbackBuilder = createRollbackBuilder(null);
    const updateMock = vi.fn(() => rollbackBuilder);

    const mockSupabase: MockOrderRollbackClient = {
      from: vi.fn(() => ({ update: updateMock })),
    };

    await rollbackOrderStatusAfterInventoryConfirmationFailure(
      asSupabaseClient(mockSupabase),
      'merchant-123',
      'order-123',
      {
        payment_status: 'pending',
        shipping_status: 'pending',
      }
    );

    expect(mockSupabase.from).toHaveBeenCalledWith('orders');
    expect(updateMock).toHaveBeenCalledWith({
      payment_status: 'pending',
      shipping_status: 'pending',
    });
    expect(rollbackBuilder.eq).toHaveBeenNthCalledWith(1, 'id', 'order-123');
    expect(rollbackBuilder.eq).toHaveBeenNthCalledWith(
      2,
      'merchant_id',
      'merchant-123'
    );
    expect(rollbackBuilder.select).toHaveBeenCalledWith('id');
    expect(rollbackBuilder.single).toHaveBeenCalledOnce();
  });

  it('restores amount_paid when the snapshot includes it', async () => {
    const rollbackBuilder = createRollbackBuilder(null);
    const updateMock = vi.fn(() => rollbackBuilder);

    const mockSupabase: MockOrderRollbackClient = {
      from: vi.fn(() => ({ update: updateMock })),
    };

    await rollbackOrderStatusAfterInventoryConfirmationFailure(
      asSupabaseClient(mockSupabase),
      'merchant-123',
      'order-123',
      {
        payment_status: 'bnpl_pending',
        shipping_status: 'pending',
        amount_paid: 0,
      }
    );

    expect(updateMock).toHaveBeenCalledWith({
      payment_status: 'bnpl_pending',
      shipping_status: 'pending',
      amount_paid: 0,
    });
  });

  it('throws when the rollback update fails', async () => {
    const rollbackBuilder = createRollbackBuilder({
      message: 'rollback failed',
    });
    const updateMock = vi.fn(() => rollbackBuilder);

    const mockSupabase: MockOrderRollbackClient = {
      from: vi.fn(() => ({ update: updateMock })),
    };

    await expect(
      rollbackOrderStatusAfterInventoryConfirmationFailure(
        asSupabaseClient(mockSupabase),
        'merchant-123',
        'order-123',
        {
          payment_status: 'pending',
          shipping_status: 'pending',
        }
      )
    ).rejects.toThrow(
      'rollback_order_status_after_inventory_confirmation_failure failed: rollback failed'
    );
  });

  it('throws when no merchant-scoped order row is updated', async () => {
    const rollbackBuilder = createRollbackMissingRowBuilder();
    const updateMock = vi.fn(() => rollbackBuilder);

    const mockSupabase: MockOrderRollbackClient = {
      from: vi.fn(() => ({ update: updateMock })),
    };

    await expect(
      rollbackOrderStatusAfterInventoryConfirmationFailure(
        asSupabaseClient(mockSupabase),
        'merchant-123',
        'order-123',
        {
          payment_status: 'pending',
          shipping_status: 'pending',
        }
      )
    ).rejects.toThrow(
      'rollback_order_status_after_inventory_confirmation_failure failed: JSON object requested, multiple (or no) rows returned'
    );
  });
});
