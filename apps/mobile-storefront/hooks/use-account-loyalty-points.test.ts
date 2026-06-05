import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useAccountLoyaltyPoints } from './use-account-loyalty-points';

type MockCustomer = {
  email: string;
  id: string;
  loyalty_points?: number;
};

type LoyaltyPayload = {
  new?: Record<string, unknown>;
};

type MockChannel = {
  on: jest.MockedFunction<
    (
      event: string,
      filter: Record<string, unknown>,
      callback: (payload: LoyaltyPayload) => void
    ) => MockChannel
  >;
  subscribe: jest.MockedFunction<
    (callback?: (status: string, error?: Error) => void) => MockChannel
  >;
  topic: string;
};

let latestRealtimeCallback: ((payload: LoyaltyPayload) => void) | null = null;
let mockChannels: MockChannel[] = [];
const mockMaybeSingle = jest.fn(async () => ({
  data: { loyalty_points: 25 },
  error: null,
}));
const mockEq = jest.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn((_table: string) => ({ select: mockSelect }));
const mockRemoveChannel = jest.fn(async (channel: MockChannel) => {
  mockChannels = mockChannels.filter((item) => item !== channel);
});

function mockCreateChannel(topic: string): MockChannel {
  const channel: MockChannel = {
    on: jest.fn((_event, _filter, callback) => {
      latestRealtimeCallback = callback;
      return channel;
    }),
    subscribe: jest.fn(() => channel),
    topic,
  };

  mockChannels.push(channel);
  return channel;
}

jest.mock('@/lib/supabase', () => ({
  supabase: {
    channel: (topic: string) => mockCreateChannel(topic),
    from: (table: string) => mockFrom(table),
    getChannels: () => mockChannels,
    removeChannel: (channel: MockChannel) => mockRemoveChannel(channel),
  },
}));

describe('useAccountLoyaltyPoints', () => {
  const customer: MockCustomer = {
    email: 'customer@example.com',
    id: 'customer-1',
    loyalty_points: 10,
  };

  beforeEach(() => {
    latestRealtimeCallback = null;
    mockChannels = [];
    jest.clearAllMocks();
    mockMaybeSingle.mockResolvedValue({
      data: { loyalty_points: 25 },
      error: null,
    });
  });

  it('refreshes loyalty points when the account screen is focused', async () => {
    const { result } = renderHook(() =>
      useAccountLoyaltyPoints(customer, true)
    );

    expect(result.current).toBe(10);

    await waitFor(() => expect(result.current).toBe(25));

    expect(mockFrom).toHaveBeenCalledWith('customers');
    expect(mockSelect).toHaveBeenCalledWith('loyalty_points');
    expect(mockEq).toHaveBeenCalledWith('id', 'customer-1');
    expect(mockChannels).toHaveLength(1);
    expect(mockChannels[0]?.topic).toBe('account-loyalty-customer-1');
  });

  it('applies realtime loyalty point updates', async () => {
    const { result } = renderHook(() =>
      useAccountLoyaltyPoints(customer, true)
    );

    await waitFor(() => expect(latestRealtimeCallback).not.toBeNull());

    act(() => {
      latestRealtimeCallback?.({ new: { loyalty_points: 32 } });
    });

    expect(result.current).toBe(32);
  });

  it('does not subscribe while the account screen is not focused', () => {
    const { result } = renderHook(() =>
      useAccountLoyaltyPoints(customer, false)
    );

    expect(result.current).toBe(10);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockChannels).toHaveLength(0);
  });

  it('removes existing loyalty channels before subscribing', async () => {
    const staleChannel = mockCreateChannel(
      'realtime:account-loyalty-customer-1'
    );

    renderHook(() => useAccountLoyaltyPoints(customer, true));

    await waitFor(() =>
      expect(mockRemoveChannel).toHaveBeenCalledWith(staleChannel)
    );
    expect(mockChannels.map((channel) => channel.topic)).toEqual([
      'account-loyalty-customer-1',
    ]);
  });
});
