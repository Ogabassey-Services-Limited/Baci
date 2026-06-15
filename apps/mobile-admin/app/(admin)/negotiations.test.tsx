import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  channelOn: vi.fn(),
  channelSubscribe: vi.fn(),
  merchant: { id: 'merchant-1' } as { id?: string } | null,
  notificationAsync: vi.fn().mockResolvedValue(undefined),
  queryCalls: [] as Array<{ method: string; args: unknown[] }>,
  removeChannel: vi.fn(),
  selectResult: null as QueryResult | null,
  updateResult: null as QueryResult | null,
}));

type QueryResult = {
  data: unknown[] | null;
  error: Error | null;
};

const negotiationRows = [
  {
    created_at: '2026-06-05T12:00:00.000Z',
    current_price: 10_000,
    customer_id: null,
    evidence_url: null,
    id: 'negotiation-1',
    item_info: { name: 'Wireless Headphones' },
    offered_price: 8_500,
    status: 'pending',
    type: 'single',
  },
];

function makeQueryChain() {
  const chain: Record<string, unknown> = {};
  let isMutation = false;
  const passthrough =
    (method: string) =>
    (...args: unknown[]) => {
      if (method === 'update') {
        isMutation = true;
      }
      mocks.queryCalls.push({ method, args });
      return chain;
    };

  for (const method of ['select', 'order', 'update', 'eq']) {
    chain[method] = passthrough(method);
  }

  chain.then = (
    resolve: (value: QueryResult) => unknown,
    reject?: (reason?: unknown) => unknown
  ) =>
    Promise.resolve(
      isMutation
        ? (mocks.updateResult ?? { data: null, error: null })
        : (mocks.selectResult ?? { data: negotiationRows, error: null })
    ).then(resolve, reject);

  return chain;
}

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({ merchant: mocks.merchant }),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: (...args: unknown[]) => {
        mocks.channelOn(...args);
        return { subscribe: mocks.channelSubscribe };
      },
    })),
    from: vi.fn(() => makeQueryChain()),
    removeChannel: (...args: unknown[]) => mocks.removeChannel(...args),
  },
}));

vi.mock('expo-haptics', () => ({
  NotificationFeedbackType: { Error: 'error', Success: 'success' },
  notificationAsync: (...args: unknown[]) => mocks.notificationAsync(...args),
}));

vi.mock('@react-native-vector-icons/ionicons', async () => {
  const { Text } = await import('react-native');
  return {
    Ionicons: () => <Text>icon</Text>,
    default: () => <Text>icon</Text>,
    __esModule: true,
  };
});

vi.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data = [],
    keyExtractor,
    renderItem,
  }: {
    data?: unknown[];
    keyExtractor?: (item: unknown, index: number) => string;
    renderItem: (input: { index: number; item: unknown }) => ReactNode;
  }) => (
    <div aria-label="negotiation-list">
      {data.map((item, index) => (
        <div key={keyExtractor?.(item, index) ?? index}>
          {renderItem({ item, index })}
        </div>
      ))}
    </div>
  ),
}));

vi.mock('react-native', () => {
  const MockText = ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  );

  return {
    ActivityIndicator: () => <MockText>loading</MockText>,
    Alert: { alert: vi.fn() },
    Dimensions: { get: () => ({ height: 844, width: 390 }) },
    Pressable: ({
      children,
      disabled,
      onPress,
    }: {
      children?: ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) => (
      <button disabled={disabled} onClick={() => onPress?.()} type="button">
        {children}
      </button>
    ),
    RefreshControl: () => null,
    StyleSheet: { create: <T,>(styles: T) => styles },
    Text: MockText,
    View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  };
});

import { Alert } from 'react-native';
import NegotiationsScreen from './negotiations';

describe('NegotiationsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.merchant = { id: 'merchant-1' };
    mocks.queryCalls.length = 0;
    mocks.selectResult = { data: negotiationRows, error: null };
    mocks.updateResult = { data: null, error: null };
  });

  it('scopes negotiation status updates to the active merchant', async () => {
    render(<NegotiationsScreen />);

    fireEvent.click(await screen.findByText('Accept Offer'));

    await waitFor(() => {
      expect(mocks.queryCalls).toContainEqual({
        method: 'update',
        args: [{ status: 'accepted' }],
      });
    });
    expect(mocks.queryCalls).toContainEqual({
      method: 'eq',
      args: ['id', 'negotiation-1'],
    });
    expect(mocks.queryCalls).toContainEqual({
      method: 'eq',
      args: ['merchant_id', 'merchant-1'],
    });
  });

  it('does not fetch or render negotiations when the merchant context is missing', async () => {
    mocks.merchant = null;

    render(<NegotiationsScreen />);

    await waitFor(() => {
      expect(screen.queryByText('Accept Offer')).toBeNull();
    });
    expect(mocks.queryCalls.some(({ method }) => method === 'select')).toBe(
      false
    );
    expect(mocks.queryCalls.some(({ method }) => method === 'update')).toBe(
      false
    );
  });

  it('shows an error when the scoped Supabase update fails', async () => {
    mocks.updateResult = { data: null, error: new Error('permission denied') };

    render(<NegotiationsScreen />);

    fireEvent.click(await screen.findByText('Accept Offer'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'permission denied');
    });
    expect(mocks.notificationAsync).toHaveBeenCalledWith('error');
  });
});
