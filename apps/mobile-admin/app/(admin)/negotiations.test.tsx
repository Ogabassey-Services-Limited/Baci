import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  channelOn: vi.fn(),
  channelSubscribe: vi.fn(),
  notificationAsync: vi.fn().mockResolvedValue(undefined),
  queryCalls: [] as Array<{ method: string; args: unknown[] }>,
  removeChannel: vi.fn(),
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

function makeQueryChain(result: QueryResult = { data: negotiationRows, error: null }) {
  const chain: Record<string, unknown> = {};
  const passthrough =
    (method: string) =>
    (...args: unknown[]) => {
      mocks.queryCalls.push({ method, args });
      return chain;
    };

  for (const method of ['select', 'order', 'update', 'eq']) {
    chain[method] = passthrough(method);
  }

  chain.then = (
    resolve: (value: QueryResult) => unknown,
    reject?: (reason?: unknown) => unknown
  ) => Promise.resolve(result).then(resolve, reject);

  return chain;
}

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({ merchant: { id: 'merchant-1' } }),
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

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => <span>icon</span>,
  default: () => <span>icon</span>,
  __esModule: true,
}));

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

vi.mock('react-native', () => ({
  ActivityIndicator: () => <span>loading</span>,
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
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

import NegotiationsScreen from './negotiations';

describe('NegotiationsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryCalls.length = 0;
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
});
