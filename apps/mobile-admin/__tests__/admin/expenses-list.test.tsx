import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ComponentType, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type TestBranchScope = { type: 'all' } | { type: 'branch'; branchId: string };

const mocks = vi.hoisted(() => ({
  branchScope: { type: 'branch', branchId: 'branch-1' } as TestBranchScope,
  queryCalls: [] as Array<{ method: string; args: unknown[] }>,
  queryPromises: [] as Array<Promise<unknown>>,
  queryResult: { data: [], error: null } as {
    data: unknown[] | null;
    error: Error | null;
  },
  queryState: null as
    | {
        data?: unknown[];
        error: Error | null;
        isError: boolean;
        isLoading: boolean;
      }
    | null,
  router: { back: vi.fn(), push: vi.fn() },
}));

function makeQueryChain() {
  const chain: Record<string, unknown> = {};
  const passthrough =
    (method: string) =>
    (...args: unknown[]) => {
      mocks.queryCalls.push({ method, args });
      return chain;
    };

  for (const method of ['select', 'eq', 'order']) {
    chain[method] = passthrough(method);
  }
  chain.then = (
    resolve: (value: { data: unknown[] | null; error: Error | null }) => unknown,
    reject?: (reason?: unknown) => unknown
  ) => Promise.resolve(mocks.queryResult).then(resolve, reject);
  return chain;
}

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryFn }: { queryFn: () => Promise<unknown> }) => {
    mocks.queryPromises.push(Promise.resolve(queryFn()));
    return (
      mocks.queryState ?? {
        data: [],
        error: null,
        isError: false,
        isLoading: false,
      }
    );
  },
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({
    merchant: { id: 'merchant-1', payout_currency: 'NGN' },
  }),
}));

vi.mock('@/hooks/useBranchScope', () => ({
  useBranchScope: () => ({ scope: mocks.branchScope }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#020617',
      border: '#334155',
      card: '#111827',
      primary: '#3b82f6',
      text: '#f8fafc',
      textMuted: '#94a3b8',
      textSecondary: '#cbd5e1',
    },
    isDark: true,
    shadows: { md: {}, lg: {} },
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => makeQueryChain(),
  },
}));

vi.mock('@shopify/flash-list', async () => {
  const React = await import('react');

  function renderEmptyComponent(
    ListEmptyComponent?: ComponentType | ReactNode
  ) {
    if (!ListEmptyComponent) {
      return null;
    }

    if (React.isValidElement(ListEmptyComponent)) {
      return ListEmptyComponent;
    }

    if (typeof ListEmptyComponent === 'function') {
      return React.createElement(ListEmptyComponent);
    }

    return ListEmptyComponent;
  }

  return {
    FlashList: ({
      data = [],
      keyExtractor,
      ListEmptyComponent,
      renderItem,
    }: {
      data?: unknown[];
      keyExtractor?: (item: unknown, index: number) => string;
      ListEmptyComponent?: ComponentType | ReactNode;
      renderItem: (input: { index: number; item: unknown }) => ReactNode;
    }) => (
      <div aria-label="expenses-list">
        {data.length === 0
          ? renderEmptyComponent(ListEmptyComponent)
          : data.map((item, index) => (
              <div key={keyExtractor?.(item, index) ?? index}>
                {renderItem({ item, index })}
              </div>
            ))}
      </div>
    ),
  };
});

vi.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  useRouter: () => mocks.router,
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => <span>icon</span>,
}));

vi.mock('react-native-edge-to-edge', () => ({
  SystemBars: () => null,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('@/components/ui/ScreenSkeleton', () => ({
  ScreenSkeleton: () => <div>loading</div>,
}));

vi.mock('react-native', () => ({
  Pressable: ({
    children,
    onPress,
  }: {
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button onClick={() => onPress?.()} type="button">
      {children}
    </button>
  ),
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

import ExpensesScreen from '@/app/(admin)/expenses';

describe('ExpensesScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryCalls.length = 0;
    mocks.queryPromises.length = 0;
    mocks.queryResult = { data: [], error: null };
    mocks.queryState = null;
    mocks.branchScope = { type: 'branch', branchId: 'branch-1' };
  });

  it('filters expenses by selected branch scope', () => {
    render(<ExpensesScreen />);

    expect(
      mocks.queryCalls.some(
        (call) =>
          call.method === 'eq' &&
          call.args[0] === 'merchant_id' &&
          call.args[1] === 'merchant-1'
      )
    ).toBe(true);
    expect(
      mocks.queryCalls.filter(
        (call) => call.method === 'eq' && call.args[0] === 'branch_id'
      )
    ).toEqual([{ method: 'eq', args: ['branch_id', 'branch-1'] }]);
  });

  it('does not filter expenses by branch in all-location scope', () => {
    mocks.branchScope = { type: 'all' };

    render(<ExpensesScreen />);

    expect(
      mocks.queryCalls.filter(
        (call) => call.method === 'eq' && call.args[0] === 'branch_id'
      )
    ).toEqual([]);
  });

  it('renders the empty state when there are no expenses', () => {
    mocks.queryState = {
      data: [],
      error: null,
      isError: false,
      isLoading: false,
    };

    render(<ExpensesScreen />);

    expect(screen.getByText('No expenses recorded yet')).toBeInTheDocument();
  });

  it('renders the loading skeleton when expenses are loading', () => {
    mocks.queryState = {
      data: undefined,
      error: null,
      isError: false,
      isLoading: true,
    };

    render(<ExpensesScreen />);

    expect(screen.getByText('loading')).toBeInTheDocument();
  });

  it('renders expense rows returned by the query', () => {
    mocks.queryState = {
      data: [
        {
          amount: 12_500,
          branch_id: 'branch-1',
          category: 'Inventory',
          date: '2026-05-05T00:00:00.000Z',
          description: 'Office internet',
          id: 'expense-1',
          receipt_url: null,
        },
      ],
      error: null,
      isError: false,
      isLoading: false,
    };

    render(<ExpensesScreen />);

    expect(screen.getByText('Inventory')).toBeInTheDocument();
    expect(screen.getByText('Office internet')).toBeInTheDocument();
  });

  it('shows an error state when expenses fail to load', () => {
    mocks.queryState = {
      data: undefined,
      error: new Error('Database error'),
      isError: true,
      isLoading: false,
    };

    render(<ExpensesScreen />);

    expect(screen.getByText('Could not load expenses')).toBeInTheDocument();
  });
});
