import type { SupabaseClient } from '@supabase/supabase-js';
import type { Mock } from 'vitest';
import { vi } from 'vitest';
import type { JumiaOrder, JumiaOrderItem } from '@/schemas/jumia';

interface QueryOptions {
  terminalEqCall?: number;
  terminalInsert?: boolean;
  terminalIn?: boolean;
  terminalUpsert?: boolean;
}

export interface QueryMock {
  select: Mock<(_columns?: string) => QueryMock>;
  eq: Mock<
    (_column?: string, _value?: unknown) => QueryMock | Promise<unknown>
  >;
  in: Mock<
    (_column?: string, _values?: unknown[]) => QueryMock | Promise<unknown>
  >;
  insert: Mock<(_payload?: unknown) => QueryMock | Promise<unknown>>;
  update: Mock<(_payload?: unknown) => QueryMock>;
  upsert: Mock<
    (_payload?: unknown, _options?: unknown) => QueryMock | Promise<unknown>
  >;
  delete: Mock<() => QueryMock>;
  maybeSingle: Mock<() => Promise<unknown>>;
  returns: Mock<() => Promise<unknown>>;
  single: Mock<() => Promise<unknown>>;
}

export function createQuery(
  response: unknown,
  options: QueryOptions = {}
): QueryMock {
  let eqCalls = 0;
  const query = {} as QueryMock;
  query.select = vi.fn((_columns?: string) => query);
  query.eq = vi.fn((_column?: string, _value?: unknown) => {
    eqCalls += 1;
    return options.terminalEqCall === eqCalls
      ? Promise.resolve(response)
      : query;
  });
  query.in = vi.fn((_column?: string, _values?: unknown[]) =>
    options.terminalIn ? Promise.resolve(response) : query
  );
  query.insert = vi.fn((_payload?: unknown) =>
    options.terminalInsert ? Promise.resolve(response) : query
  );
  query.update = vi.fn((_payload?: unknown) => query);
  query.upsert = vi.fn((_payload?: unknown, _options?: unknown) =>
    options.terminalUpsert ? Promise.resolve(response) : query
  );
  query.delete = vi.fn(() => query);
  query.maybeSingle = vi.fn(() => Promise.resolve(response));
  query.returns = vi.fn(() => Promise.resolve(response));
  query.single = vi.fn(() => Promise.resolve(response));

  return query;
}

/**
 * Creates a partial SupabaseClient mock that supports queued `from()` and `rpc()`
 * responses. Other SupabaseClient members are intentionally not implemented.
 */
export function createSupabaseMock(
  tableQueries: Record<string, unknown[]>,
  rpcResponses: Record<string, unknown[]> = {}
): SupabaseClient {
  const tableQueryIndexes = new Map<string, number>();
  const rpcResponseIndexes = new Map<string, number>();

  return {
    from: vi.fn((table: string) => {
      const index = tableQueryIndexes.get(table) ?? 0;
      const query = tableQueries[table]?.[index];
      if (!query) {
        const queuedCount = tableQueries[table]?.length ?? 0;
        throw new Error(
          `Unexpected table "${table}" at call ${index + 1} (${queuedCount} queued)`
        );
      }
      tableQueryIndexes.set(table, index + 1);
      return query;
    }),
    rpc: vi.fn((fnName: string) => {
      const index = rpcResponseIndexes.get(fnName) ?? 0;
      const response = rpcResponses[fnName]?.[index];
      if (!response) {
        const queuedCount = rpcResponses[fnName]?.length ?? 0;
        throw new Error(
          `Unexpected RPC "${fnName}" at call ${index + 1} (${queuedCount} queued)`
        );
      }
      rpcResponseIndexes.set(fnName, index + 1);
      return Promise.resolve(response);
    }),
  } as unknown as SupabaseClient;
}

export const order: JumiaOrder = {
  id: 'jumia-order-1',
  shopIds: ['shop-1'],
  totalItems: 1,
  packedItems: 0,
  isPrepayment: true,
  hasMultipleStatus: false,
  hasItemsFulfilledByJumia: false,
  pendingSince: '2026-04-25T08:00:00.000Z',
  status: 'ready_to_ship',
  deliveryOption: 'standard',
  number: '12345',
  totalAmount: { currency: 'NGN', value: 250000 },
  country: { code: 'NG', name: 'Nigeria', currencyCode: 'NGN' },
  shippingAddress: {
    firstName: 'Ada',
    lastName: 'Lovelace',
    address: '10 Jumia Road',
    city: 'Lagos',
    postalCode: '100001',
    ward: 'Ikeja',
    region: 'Lagos',
    countryName: 'Nigeria',
  },
  createdAt: '2026-04-25T08:01:00.000Z',
  updatedAt: '2026-04-25T08:02:00.000Z',
  totalAmountLocal: { currency: 'NGN', value: 250000 },
};

export const item: JumiaOrderItem = {
  id: 'item-1',
  shopId: 'shop-1',
  product: {
    name: 'Samsung Phone',
    sellerSku: 'SKU-1',
    imageUrl: 'https://example.com/phone.jpg',
  },
  status: 'ready_to_ship',
  trackingNumber: '',
  trackingUrl: '',
  shipmentType: 'standard',
  deliveryOption: 'standard',
  isFulfilledByJumia: false,
  itemPrice: 250000,
  paidPrice: 245000,
  shippingAmount: 0,
  itemPriceLocal: 250000,
  paidPriceLocal: 245000,
  shippingAmountLocal: 0,
  exchangeRate: 1,
  country: { code: 'NG', name: 'Nigeria', currencyCode: 'NGN' },
  taxAmount: 0,
  voucherAmount: 5000,
  shippingAddress: { ...order.shippingAddress },
};
