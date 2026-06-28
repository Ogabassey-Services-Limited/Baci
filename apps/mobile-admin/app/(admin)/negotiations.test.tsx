import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { type ReactNode, useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  channelOn: vi.fn(),
  channelSubscribe: vi.fn(),
  canOpenURL: vi.fn().mockResolvedValue(true),
  createSignedUrl: vi.fn().mockResolvedValue({
    data: { signedUrl: 'https://signed.example/evidence.png' },
    error: null,
  }),
  merchant: { id: 'merchant-1' } as { id?: string } | null,
  notificationAsync: vi.fn().mockResolvedValue(undefined),
  openURL: vi.fn().mockResolvedValue(undefined),
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
    customer_id: null,
    evidence_url: null,
    id: 'negotiation-1',
    item_info: { name: 'Wireless Headphones', current_price: 10_000 },
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

  // biome-ignore lint/suspicious/noThenProperty: Supabase query builders are thenable, so the mock must be too.
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
  useMerchant: () => ({ merchant: mocks.merchant, isLoading: false }),
}));

vi.mock('@tanstack/react-query', () => {
  return {
    useQueryClient: () => ({
      invalidateQueries: () => {
        mocks.queryCalls.push({
          method: 'select',
          args: [
            'id, customer_id, type, status, offered_price, item_info, cart_snapshot, customer_phone, created_at, evidence_url',
          ],
        });
        mocks.queryCalls.push({
          method: 'eq',
          args: ['merchant_id', mocks.merchant?.id],
        });
      },
    }),
    useQuery: (options: { queryKey: unknown[]; enabled?: boolean }) => {
      const enabled = options.enabled ?? true;
      if (options.queryKey[0] === 'negotiation_requests') {
        const selectResult = mocks.selectResult ?? { data: negotiationRows, error: null };
        const dataRows = (selectResult.data ?? []) as Array<{
          cart_snapshot?: unknown;
          item_info?: { current_price?: number };
        }>;
        const formattedData = dataRows.map((row) => ({
          ...row,
          cart_snapshot: Array.isArray(row.cart_snapshot)
            ? row.cart_snapshot
            : null,
          current_price: row.item_info?.current_price ?? null,
        }));
        return {
          data: enabled ? formattedData : [],
          isLoading: false,
          error: selectResult.error,
          refetch: vi.fn().mockImplementation(async () => {
            mocks.queryCalls.push({
              method: 'select',
              args: [
                'id, customer_id, type, status, offered_price, item_info, cart_snapshot, customer_phone, created_at, evidence_url',
              ],
            });
            mocks.queryCalls.push({
              method: 'eq',
              args: ['merchant_id', mocks.merchant?.id],
            });
            return selectResult;
          }),
        };
      }
      return { data: null, isLoading: false, error: null, refetch: vi.fn() };
    },
    useMutation: <TVariables = unknown, TData = unknown>({
      mutationFn,
      onSuccess,
      onError,
    }: {
      mutationFn: (variables: TVariables) => Promise<TData>;
      onSuccess?: (data: TData, variables: TVariables) => void;
      onError?: (error: unknown, variables: TVariables) => void;
    }) => {
      const [isPending, setIsPending] = useState(false);
      const [variables, setVariables] = useState<TVariables | null>(null);
      return {
        isPending,
        variables,
        mutate: async (vars: TVariables) => {
          setIsPending(true);
          setVariables(vars);
          try {
            const res = await mutationFn(vars);
            onSuccess?.(res, vars);
            return res;
          } catch (err) {
            onError?.(err, vars);
          } finally {
            setIsPending(false);
            setVariables(null);
          }
        },
      };
    },
  };
});

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
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: (...args: unknown[]) => mocks.createSignedUrl(...args),
      })),
    },
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
    <ul aria-label="negotiation-list">
      {data.map((item, index) => (
        <li key={keyExtractor?.(item, index) ?? index}>
          {renderItem({ item, index })}
        </li>
      ))}
    </ul>
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
    Linking: {
      canOpenURL: (...args: unknown[]) => mocks.canOpenURL(...args),
      openURL: (...args: unknown[]) => mocks.openURL(...args),
    },
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
    useColorScheme: () => 'light',
  };
});

import { Alert } from 'react-native';
import NegotiationsScreen from './negotiations';

describe('NegotiationsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.canOpenURL.mockResolvedValue(true);
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed.example/evidence.png' },
      error: null,
    });
    mocks.merchant = { id: 'merchant-1' };
    mocks.queryCalls.length = 0;
    mocks.selectResult = { data: negotiationRows, error: null };
    // Default: the update affected one still-pending row (success path).
    mocks.updateResult = { data: [{ id: 'negotiation-1' }], error: null };
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

  it('subscribes to all merchant negotiation row changes', async () => {
    render(<NegotiationsScreen />);

    await waitFor(() => {
      expect(mocks.channelOn).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: '*',
          filter: 'merchant_id=eq.merchant-1',
          schema: 'public',
          table: 'negotiation_requests',
        }),
        expect.any(Function)
      );
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

  it('reveals the itemized cart snapshot for a bulk offer when expanded', async () => {
    mocks.selectResult = {
      data: [
        {
          created_at: '2026-06-24T23:58:50.000Z',
          customer_id: null,
          evidence_url: null,
          id: 'negotiation-total-1',
          item_info: { name: '3 items: iPhone 15 Pro, Galaxy S24' },
          cart_snapshot: [
            {
              product_id: 'p1',
              name: 'iPhone 15 Pro',
              price: 1_200_000,
              quantity: 1,
              condition: 'new',
            },
            {
              product_id: 'p2',
              name: 'Galaxy S24',
              price: 900_000,
              quantity: 2,
            },
          ],
          offered_price: 420_000,
          status: 'pending',
          type: 'total',
        },
      ],
      error: null,
    };

    render(<NegotiationsScreen />);

    // Collapsed by default: line items are hidden behind the toggle.
    const toggle = await screen.findByText('View 2 items');
    expect(screen.queryByText('iPhone 15 Pro')).toBeNull();

    fireEvent.click(toggle);

    expect(await screen.findByText('iPhone 15 Pro')).toBeInTheDocument();
    expect(screen.getByText('Galaxy S24')).toBeInTheDocument();
    // Quantity-aware line total: 900,000 × 2 (currency symbol varies by ICU).
    expect(screen.getByText(/1,800,000/)).toBeInTheDocument();
    expect(screen.getByText('Hide items')).toBeInTheDocument();
  });

  it('opens WhatsApp and a dialer for a customer with a phone number', async () => {
    mocks.selectResult = {
      data: [
        {
          created_at: '2026-06-24T23:58:50.000Z',
          customer_id: 'customer-9',
          customer_phone: '0803 123 4567',
          evidence_url: null,
          id: 'negotiation-phone-1',
          item_info: { name: 'Wireless Headphones' },
          offered_price: 8_500,
          status: 'pending',
          type: 'single',
        },
      ],
      error: null,
    };

    render(<NegotiationsScreen />);

    fireEvent.click(await screen.findByText('WhatsApp'));
    await waitFor(() => {
      expect(mocks.openURL).toHaveBeenCalledWith(
        expect.stringContaining('https://wa.me/2348031234567')
      );
    });

    fireEvent.click(screen.getByText('Call'));
    await waitFor(() => {
      expect(mocks.openURL).toHaveBeenCalledWith('tel:+2348031234567');
    });
    expect(mocks.canOpenURL).not.toHaveBeenCalledWith('tel:+2348031234567');
  });

  it('hides contact buttons when no phone number was captured', async () => {
    render(<NegotiationsScreen />);

    await screen.findByText('Accept Offer');
    expect(screen.queryByText('WhatsApp')).toBeNull();
    expect(screen.queryByText('Call')).toBeNull();
  });

  it('hides accept and reject actions for completed negotiations', async () => {
    mocks.selectResult = {
      data: [
        {
          ...negotiationRows[0],
          id: 'negotiation-accepted-1',
          status: 'accepted',
        },
      ],
      error: null,
    };

    render(<NegotiationsScreen />);

    expect(await screen.findByText('Accepted')).toBeInTheDocument();
    expect(screen.queryByText('Accept Offer')).toBeNull();
    expect(screen.queryByText('Reject')).toBeNull();
  });

  it('opens the evidence link in the OS handler', async () => {
    mocks.selectResult = {
      data: [
        {
          created_at: '2026-06-24T23:58:50.000Z',
          customer_id: null,
          customer_phone: null,
          evidence_url: 'https://x.com/i/status/123',
          id: 'negotiation-evidence-1',
          item_info: { name: 'Wireless Headphones' },
          offered_price: 8_500,
          status: 'pending',
          type: 'single',
        },
      ],
      error: null,
    };

    render(<NegotiationsScreen />);

    fireEvent.click(await screen.findByText('View customer evidence'));
    await waitFor(() => {
      expect(mocks.openURL).toHaveBeenCalledWith('https://x.com/i/status/123');
    });
  });

  it('shows an error when an external evidence URL cannot be opened', async () => {
    mocks.openURL.mockRejectedValueOnce(new Error('blocked'));
    mocks.selectResult = {
      data: [
        {
          created_at: '2026-06-24T23:58:50.000Z',
          customer_id: null,
          customer_phone: null,
          evidence_url: 'https://x.com/i/status/123',
          id: 'negotiation-evidence-unsupported',
          item_info: { name: 'Wireless Headphones' },
          offered_price: 8_500,
          status: 'pending',
          type: 'single',
        },
      ],
      error: null,
    };

    render(<NegotiationsScreen />);

    fireEvent.click(await screen.findByText('View customer evidence'));
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Cannot open link',
        'https://x.com/i/status/123'
      );
    });
    expect(mocks.canOpenURL).not.toHaveBeenCalledWith(
      'https://x.com/i/status/123'
    );
    expect(mocks.openURL).toHaveBeenCalledWith('https://x.com/i/status/123');
  });

  it('opens stored evidence paths through a fresh signed URL', async () => {
    mocks.selectResult = {
      data: [
        {
          created_at: '2026-06-24T23:58:50.000Z',
          customer_id: null,
          customer_phone: null,
          evidence_url: 'merchant-1/1719260000000-proof.png',
          id: 'negotiation-evidence-storage',
          item_info: { name: 'Wireless Headphones' },
          offered_price: 8_500,
          status: 'pending',
          type: 'single',
        },
      ],
      error: null,
    };

    render(<NegotiationsScreen />);

    fireEvent.click(await screen.findByText('View customer evidence'));
    await waitFor(() => {
      expect(mocks.createSignedUrl).toHaveBeenCalledWith(
        'merchant-1/1719260000000-proof.png',
        3600
      );
      expect(mocks.openURL).toHaveBeenCalledWith(
        'https://signed.example/evidence.png'
      );
    });
  });

  it('shows non-URL evidence as text instead of opening a link', async () => {
    mocks.selectResult = {
      data: [
        {
          created_at: '2026-06-24T23:58:50.000Z',
          customer_id: null,
          customer_phone: null,
          evidence_url: 'uploaded_evidence_placeholder',
          id: 'negotiation-evidence-2',
          item_info: { name: 'Wireless Headphones' },
          offered_price: 8_500,
          status: 'pending',
          type: 'single',
        },
      ],
      error: null,
    };

    render(<NegotiationsScreen />);

    fireEvent.click(await screen.findByText('View customer evidence'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Customer evidence',
      'uploaded_evidence_placeholder'
    );
    expect(mocks.openURL).not.toHaveBeenCalled();
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

  it('shows a stale-state error and refreshes when the request was already handled', async () => {
    // The status='pending' filter matched zero rows (another admin acted first).
    mocks.updateResult = { data: [], error: null };

    render(<NegotiationsScreen />);

    fireEvent.click(await screen.findByText('Accept Offer'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'This request was already handled. Pull to refresh.'
      );
    });
    // Must NOT report success or notify the customer for a no-op update.
    expect(mocks.notificationAsync).toHaveBeenCalledWith('error');
    expect(mocks.notificationAsync).not.toHaveBeenCalledWith('success');
    await waitFor(() => {
      expect(
        mocks.queryCalls.filter(({ method }) => method === 'select').length
      ).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows a scheme-less competitor image link as text instead of signing it', async () => {
    mocks.selectResult = {
      data: [
        {
          created_at: '2026-06-24T23:58:50.000Z',
          customer_id: null,
          customer_phone: null,
          evidence_url: 'www.example.com/product-image.jpg',
          id: 'negotiation-evidence-schemeless',
          item_info: { name: 'Wireless Headphones' },
          offered_price: 8_500,
          status: 'pending',
          type: 'single',
        },
      ],
      error: null,
    };

    render(<NegotiationsScreen />);

    fireEvent.click(await screen.findByText('View customer evidence'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Customer evidence',
      'www.example.com/product-image.jpg'
    );
    // It is NOT a storage object, so we never attempt to sign it.
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });

  it('does not crash when cart_snapshot is malformed (non-array)', async () => {
    mocks.selectResult = {
      data: [
        {
          created_at: '2026-06-24T23:58:50.000Z',
          customer_id: null,
          customer_phone: null,
          cart_snapshot: 'definitely-not-an-array',
          evidence_url: null,
          id: 'negotiation-bad-snapshot',
          item_info: { name: '3 items' },
          offered_price: 420_000,
          status: 'pending',
          type: 'total',
        },
      ],
      error: null,
    };

    render(<NegotiationsScreen />);

    // Row still renders (no crash); the malformed snapshot is dropped, so no
    // "View … items" toggle appears.
    expect(await screen.findByText('Accept Offer')).toBeInTheDocument();
    expect(screen.queryByText(/View \d+ items?/)).toBeNull();
  });
});
