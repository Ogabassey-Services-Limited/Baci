import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExpenseDetail } from './types';

const expenseFixture = (): ExpenseDetail => ({
  amount: 12500,
  branch_id: 'branch-1',
  category: 'Inventory',
  date: '2026-05-05T00:00:00.000Z',
  description: 'Office internet',
  id: 'expense-1',
  receipt_url: null,
  reference: null,
});

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  branches: [{ id: 'branch-1', name: 'Lagos main' }],
  branchesLoading: false,
  expenseResult: {
    data: {
      amount: 12500,
      branch_id: 'branch-1',
      category: 'Inventory',
      date: '2026-05-05T00:00:00.000Z',
      description: 'Office internet',
      id: 'expense-1',
      receipt_url: null,
      reference: null,
    },
    error: null,
  } as { data: ExpenseDetail | null; error: Error | null },
  queryState: null as {
    data?: unknown;
    error?: Error | null;
    isError?: boolean;
    isLoading: boolean;
  } | null,
  queryOptions: null as {
    enabled?: boolean;
    queryKey: readonly unknown[];
  } | null,
  branchScope: { type: 'branch', branchId: 'branch-1' } as
    | { type: 'all' }
    | { type: 'branch'; branchId: string },
  eqCalls: [] as unknown[][],
  linking: {
    canOpenURL: vi.fn(() => Promise.resolve(true)),
    openURL: vi.fn(() => Promise.resolve()),
  },
  selectCalls: [] as unknown[][],
}));

function makeExpenseQuery() {
  const chain: Record<string, unknown> = {};
  chain.select = (...args: unknown[]) => {
    mocks.selectCalls.push(args);
    return chain;
  };
  chain.eq = (...args: unknown[]) => {
    mocks.eqCalls.push(args);
    return chain;
  };
  chain.single = () => Promise.resolve(mocks.expenseResult);
  return chain;
}

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({
    enabled,
    queryFn,
    queryKey,
  }: {
    enabled?: boolean;
    queryFn: () => Promise<unknown>;
    queryKey: readonly unknown[];
  }) => {
    mocks.queryOptions = { enabled, queryKey };
    if (mocks.queryState) {
      return mocks.queryState;
    }

    void queryFn();
    return {
      data: mocks.expenseResult.data,
      isLoading: false,
    };
  },
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => makeExpenseQuery(),
  },
}));

vi.mock('@/hooks/useBranches', () => ({
  useBranches: () => ({
    data: mocks.branches,
    isLoading: mocks.branchesLoading,
  }),
}));

vi.mock('@/hooks/useBranchScope', () => ({
  useBranchScope: () => ({ scope: mocks.branchScope }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({
    merchant: { id: 'merchant-1', payout_currency: 'NGN' },
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#020617',
      border: '#334155',
      card: '#111827',
      primary: '#3b82f6',
      text: '#f8fafc',
      textSecondary: '#cbd5e1',
    },
    isDark: true,
    shadows: { sm: {} },
  }),
}));

vi.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ id: 'expense-1' }),
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

vi.mock('react-native', () => ({
  Alert: { alert: mocks.alert },
  Linking: mocks.linking,
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button aria-label={accessibilityLabel} onClick={onPress} type="button">
      {children}
    </button>
  ),
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
    hairlineWidth: 1,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

import ExpenseDetailScreen from './[id]';

describe('ExpenseDetailScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.branches = [{ id: 'branch-1', name: 'Lagos main' }];
    mocks.branchesLoading = false;
    mocks.expenseResult = {
      data: expenseFixture(),
      error: null,
    };
    mocks.linking.canOpenURL.mockResolvedValue(true);
    mocks.linking.openURL.mockResolvedValue(undefined);
    mocks.queryState = null;
    mocks.queryOptions = null;
    mocks.branchScope = { type: 'branch', branchId: 'branch-1' };
    mocks.eqCalls.length = 0;
    mocks.selectCalls.length = 0;
  });

  it('selects and displays the expense branch', () => {
    render(<ExpenseDetailScreen />);

    expect(mocks.selectCalls[0]?.[0]).toContain('branch_id');
    expect(mocks.eqCalls).toContainEqual(['merchant_id', 'merchant-1']);
    expect(screen.getByText('Branch')).toBeInTheDocument();
    expect(screen.getByText('Lagos main')).toBeInTheDocument();
  });

  it('scopes branch detail lookups to the selected branch', () => {
    render(<ExpenseDetailScreen />);

    expect(mocks.queryOptions?.queryKey).toEqual([
      'expense',
      'merchant-1',
      'branch-1',
      'expense-1',
    ]);
    expect(mocks.queryOptions?.enabled).toBe(true);
    expect(mocks.eqCalls).toContainEqual(['branch_id', 'branch-1']);
  });

  it('shows the loading state while the expense is loading', () => {
    mocks.queryState = { data: undefined, isLoading: true };

    render(<ExpenseDetailScreen />);

    expect(screen.getByText('Loading expense details...')).toBeInTheDocument();
  });

  it('shows a missing state when no expense is returned', () => {
    mocks.queryState = { data: null, isLoading: false };

    render(<ExpenseDetailScreen />);

    expect(screen.getByText('Expense not found.')).toBeInTheDocument();
  });

  it('shows an error state when the expense cannot be loaded', () => {
    mocks.queryState = {
      data: undefined,
      error: new Error('Database error'),
      isError: true,
      isLoading: false,
    };

    render(<ExpenseDetailScreen />);

    expect(screen.getByText('Could not load expense.')).toBeInTheDocument();
    expect(screen.getByText('Database error')).toBeInTheDocument();
  });

  it('labels expenses without a branch as unassigned', () => {
    mocks.expenseResult.data = {
      ...expenseFixture(),
      branch_id: null,
    };

    render(<ExpenseDetailScreen />);

    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('shows branch loading text while branch metadata is loading', () => {
    mocks.branches = [];
    mocks.branchesLoading = true;

    render(<ExpenseDetailScreen />);

    expect(screen.getByText('Loading branch...')).toBeInTheDocument();
  });

  it('shows unknown branch when metadata does not include the expense branch', () => {
    mocks.branches = [];

    render(<ExpenseDetailScreen />);

    expect(screen.getByText('Unknown branch')).toBeInTheDocument();
  });

  it('opens http receipt links from the receipt action', async () => {
    mocks.expenseResult.data = {
      ...expenseFixture(),
      receipt_url: 'https://example.com/receipt.jpg',
    };

    render(<ExpenseDetailScreen />);

    fireEvent.click(
      screen.getByRole('button', { name: 'View attached receipt' })
    );

    await waitFor(() => {
      expect(mocks.linking.canOpenURL).toHaveBeenCalledWith(
        'https://example.com/receipt.jpg'
      );
      expect(mocks.linking.openURL).toHaveBeenCalledWith(
        'https://example.com/receipt.jpg'
      );
    });
  });

  it('rejects non-http receipt links before opening them', async () => {
    mocks.expenseResult.data = {
      ...expenseFixture(),
      receipt_url: 'javascript:alert(1)',
    };

    render(<ExpenseDetailScreen />);

    fireEvent.click(
      screen.getByRole('button', { name: 'View attached receipt' })
    );

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith(
        'Receipt unavailable',
        'This receipt link cannot be opened.'
      );
    });
    expect(mocks.linking.canOpenURL).not.toHaveBeenCalled();
    expect(mocks.linking.openURL).not.toHaveBeenCalled();
  });
});
