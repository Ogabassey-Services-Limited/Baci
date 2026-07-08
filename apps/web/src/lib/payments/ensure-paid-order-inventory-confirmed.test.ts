import { describe, expect, it, vi } from 'vitest';
import {
  ensurePaidOrderInventoryConfirmed,
  isSerializedInventoryUnavailableError,
  rollbackOrderStatusAfterInventoryConfirmationFailure,
} from '@/lib/payments/ensure-paid-order-inventory-confirmed';

interface MockSupabaseRpcClient {
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

describe('ensurePaidOrderInventoryConfirmed', () => {
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
