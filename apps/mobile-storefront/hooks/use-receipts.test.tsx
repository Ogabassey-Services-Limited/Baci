import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { View } from 'react-native';

type QueryOptions = {
  enabled?: boolean;
  queryFn: () => Promise<unknown>;
};

type SupabaseListResponse = {
  data: unknown[] | null;
  error: Error | null;
};

type SupabaseSingleResponse = {
  data: unknown;
  error: Error | null;
};

type MockAuthState = {
  merchantId: string | null;
  user: { id: string } | null;
};

const mockUseQuery = jest.fn((options: unknown) => options);
const mockWithSupabaseRetry = jest.fn(
  async (callback: () => Promise<unknown>) => callback()
);
const mockAuthState: MockAuthState = {
  merchantId: 'merchant-1',
  user: { id: 'auth-user-1' },
};
const mockOrder = jest.fn<() => Promise<SupabaseListResponse>>();
const mockSingle = jest.fn<() => Promise<SupabaseSingleResponse>>();
const mockLimit = jest.fn<() => Promise<SupabaseListResponse>>();
const mockQueryBuilder = {
  eq: jest.fn((_field: string, _value: string) => mockQueryBuilder),
  limit: mockLimit,
  order: mockOrder,
  select: jest.fn((_columns: string) => mockQueryBuilder),
  single: mockSingle,
};
const mockFrom = jest.fn((_table: string) => mockQueryBuilder);
const mockUseAuthStore = Object.assign(
  jest.fn((selector: (state: MockAuthState) => unknown) =>
    selector(mockAuthState)
  ),
  {
    getState: jest.fn(() => mockAuthState),
  }
);

jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => mockUseQuery(options),
}));

jest.mock('@/lib/api', () => ({
  withSupabaseRetry: (callback: () => Promise<unknown>) =>
    mockWithSupabaseRetry(callback),
}));

jest.mock('@/lib/config', () => ({
  CONFIG: { MERCHANT_ID: 'merchant-1', MERCHANT_SLUG: 'ogabassey' },
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ warn: jest.fn() }),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: mockUseAuthStore,
}));

describe('useReceipts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState.merchantId = 'merchant-1';
    mockAuthState.user = { id: 'auth-user-1' };
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockSingle.mockResolvedValue({ data: null, error: null });
    mockLimit.mockResolvedValue({ data: [], error: null });
  });

  it('loads receipts through the customer linked to the authenticated user and merchant', async () => {
    const { useReceipts } = await import('@/hooks/use-receipts');

    function Probe() {
      useReceipts('auth-user-1');
      return <View testID="probe" />;
    }

    render(<Probe />);
    const options = mockUseQuery.mock.calls[0]?.[0] as QueryOptions;
    await options.queryFn();

    expect(mockFrom).toHaveBeenCalledWith('orders');
    expect(mockQueryBuilder.select).toHaveBeenCalledWith(
      expect.stringContaining('customers!inner')
    );
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
      'customers.user_id',
      'auth-user-1'
    );
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-1'
    );
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
  });

  it('does not query receipts when the authenticated user scope is missing', async () => {
    const { useReceipts } = await import('@/hooks/use-receipts');

    function Probe() {
      useReceipts(undefined);
      return <View testID="probe" />;
    }

    render(<Probe />);
    const options = mockUseQuery.mock.calls[0]?.[0] as QueryOptions;

    expect(options.enabled).toBe(false);
    await expect(options.queryFn()).resolves.toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('propagates receipt list Supabase errors', async () => {
    const { useReceipts } = await import('@/hooks/use-receipts');
    mockOrder.mockResolvedValue({
      data: null,
      error: new Error('receipt list failed'),
    });

    function Probe() {
      useReceipts('auth-user-1');
      return <View testID="probe" />;
    }

    render(<Probe />);
    const options = mockUseQuery.mock.calls[0]?.[0] as QueryOptions;

    await expect(options.queryFn()).rejects.toThrow('receipt list failed');
  });

  it('scopes receipt detail prefetches to the current authenticated user and merchant', async () => {
    const { receiptDetailQueryOptions } = await import('@/hooks/use-receipts');
    mockSingle.mockResolvedValue({
      data: {
        amount_paid: 95000,
        created_at: '2026-05-24T10:00:00.000Z',
        currency: 'NGN',
        customer_email: 'ada@example.com',
        customer_name: 'Ada',
        customer_phone: null,
        discount_amount: 0,
        id: 'order-1',
        is_credit_order: false,
        notes: null,
        order_items: [],
        order_number: 'OG-1001',
        payment_method: null,
        payment_status: 'paid',
        shipping_address: null,
        shipping_fee: 0,
        subtotal: 95000,
        tax_amount: 0,
        total: 95000,
      },
      error: null,
    });

    const options = receiptDetailQueryOptions('order-1') as QueryOptions;
    await options.queryFn();

    expect(options).toEqual(
      expect.objectContaining({
        queryKey: ['receipt-detail', 'order-1', 'auth-user-1', 'merchant-1'],
      })
    );
    expect(mockQueryBuilder.select).toHaveBeenCalledWith(
      expect.stringContaining('customers!inner')
    );
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'order-1');
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-1'
    );
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
      'customers.user_id',
      'auth-user-1'
    );
  });

  it('requires user and merchant scope for receipt detail prefetches', async () => {
    const { receiptDetailQueryOptions } = await import('@/hooks/use-receipts');

    await expect(
      (
        receiptDetailQueryOptions('order-1', {
          merchantId: 'merchant-1',
          userId: null,
        }) as QueryOptions
      ).queryFn()
    ).rejects.toThrow('Authentication required to load receipt');
    await expect(
      (
        receiptDetailQueryOptions('order-1', {
          merchantId: null,
          userId: 'auth-user-1',
        }) as QueryOptions
      ).queryFn()
    ).rejects.toThrow('Authentication required to load receipt');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('propagates receipt detail Supabase errors', async () => {
    const { receiptDetailQueryOptions } = await import('@/hooks/use-receipts');
    mockSingle.mockResolvedValue({
      data: null,
      error: new Error('receipt detail failed'),
    });

    await expect(
      (receiptDetailQueryOptions('order-1') as QueryOptions).queryFn()
    ).rejects.toThrow('receipt detail failed');
  });
});
