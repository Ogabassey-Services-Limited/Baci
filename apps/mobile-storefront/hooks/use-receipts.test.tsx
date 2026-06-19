import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { View } from 'react-native';

type QueryOptions = {
  queryFn: () => Promise<unknown>;
};

const mockUseQuery = jest.fn((options: unknown) => options);
const mockWithSupabaseRetry = jest.fn(async (callback: () => Promise<unknown>) =>
  callback()
);
const mockOrder = jest.fn<() => Promise<{ data: unknown[]; error: null }>>();
const mockEq = jest.fn((_field: string, _value: string) => ({
  order: mockOrder,
}));
const mockSelect = jest.fn((_columns: string) => ({ eq: mockEq }));
const mockFrom = jest.fn((_table: string) => ({ select: mockSelect }));

jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => mockUseQuery(options),
}));

jest.mock('@/lib/api', () => ({
  withSupabaseRetry: (callback: () => Promise<unknown>) =>
    mockWithSupabaseRetry(callback),
}));

jest.mock('@/lib/config', () => ({
  CONFIG: { MERCHANT_SLUG: 'ogabassey' },
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ warn: jest.fn() }),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}));

describe('useReceipts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOrder.mockResolvedValue({ data: [], error: null });
  });

  it('loads receipts through the customer linked to the authenticated user', async () => {
    const { useReceipts } = await import('@/hooks/use-receipts');

    function Probe() {
      useReceipts('auth-user-1');
      return <View testID="probe" />;
    }

    render(<Probe />);
    const options = mockUseQuery.mock.calls[0]?.[0] as QueryOptions;
    await options.queryFn();

    expect(mockFrom).toHaveBeenCalledWith('orders');
    expect(mockSelect).toHaveBeenCalledWith(
      expect.stringContaining('customers!inner')
    );
    expect(mockEq).toHaveBeenCalledWith('customers.user_id', 'auth-user-1');
    expect(mockOrder).toHaveBeenCalledWith('created_at', { ascending: false });
  });
});
