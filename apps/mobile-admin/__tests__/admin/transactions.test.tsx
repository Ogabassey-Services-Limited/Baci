import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  useTransactionReview: vi.fn(),
  useUpdateTransactionCostPrice: vi.fn(),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: () =>
      React.createElement('div', { role: 'progressbar' }),
    Pressable: ({
      accessibilityLabel,
      children,
      disabled,
      onPress,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          disabled,
          onClick: () => onPress?.(),
        },
        children
      ),
    ScrollView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    StyleSheet: {
      create: <T,>(styles: T) => styles,
      hairlineWidth: 1,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => children,
}));

vi.mock('react-native-edge-to-edge', () => ({
  SystemBars: () => null,
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

vi.mock('expo-router', async () => {
  const React = await import('react');

  return {
    Stack: {
      Screen: () => React.createElement('div'),
    },
    useLocalSearchParams: () => ({}),
  };
});

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      error: '#f00',
      primary: '#2563eb',
      text: '#111',
      textMuted: '#666',
      textOnPrimary: '#fff',
      textSecondary: '#555',
      warning: '#d97706',
    },
    isDark: false,
  }),
}));

vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({
    format: (amount: number) => `NGN ${amount}`,
  }),
}));

vi.mock('@/hooks/useTransactionReview', () => ({
  useTransactionReview: mocks.useTransactionReview,
}));

vi.mock('@/hooks/useUpdateTransactionCostPrice', () => ({
  useUpdateTransactionCostPrice: mocks.useUpdateTransactionCostPrice,
}));

vi.mock('@/components/transactions/TransactionsSummary', () => ({
  TransactionsSummary: ({
    estimatedProfitLabel,
    summary,
  }: {
    estimatedProfitLabel: string;
    summary: { missingCosts: number; transactions: number };
  }) => (
    <div>
      <span>{estimatedProfitLabel}</span>
      <span>{summary.transactions} transactions</span>
      <span>{summary.missingCosts} missing costs</span>
    </div>
  ),
}));

vi.mock('@/components/transactions/TransactionOrderCard', () => ({
  TransactionOrderCard: ({
    onOpenEditor,
    order,
  }: {
    onOpenEditor: (item: {
      costPrice: number | null;
      id: string;
      name: string;
      productId: string | null;
    }) => void;
    order: {
      items: Array<{
        costPrice: number | null;
        id: string;
        name: string;
        productId: string | null;
      }>;
      orderNumber: string;
    };
  }) => (
    <button type="button" onClick={() => onOpenEditor(order.items[0])}>
      Edit {order.orderNumber}
    </button>
  ),
}));

vi.mock('@/components/transactions/CostPriceEditorModal', () => ({
  CostPriceEditorModal: ({
    costPriceInput,
    onChangeCostPrice,
    onClose,
    onSave,
    saveError,
    visible,
  }: {
    costPriceInput: string;
    onChangeCostPrice: (value: string) => void;
    onClose: () => void;
    onSave: () => void;
    saveError: string | null;
    visible: boolean;
  }) =>
    visible ? (
      <div>
        <input
          aria-label="Cost price input"
          value={costPriceInput}
          onChange={(event) => onChangeCostPrice(event.target.value)}
        />
        {saveError ? <span>{saveError}</span> : null}
        <button type="button" onClick={onSave}>
          Save cost price
        </button>
        <button type="button" onClick={onClose}>
          Close editor
        </button>
      </div>
    ) : null,
}));

import TransactionsScreen from '@/app/(admin)/transactions';

const sampleOrders = [
  {
    createdAt: '2026-04-10T10:00:00.000Z',
    customerName: 'Bassey',
    estimatedProfit: 3000,
    id: 'order-1',
    items: [
      {
        costPrice: null,
        id: 'item-1',
        name: 'Samsung Galaxy S26',
        productId: 'product-1',
        profit: null,
        quantity: 1,
        revenue: 5000,
      },
    ],
    missingCostCount: 1,
    orderNumber: 'ORD-1',
    paymentMethod: 'card',
    total: 5000,
  },
];

describe('TransactionsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mutateAsync.mockResolvedValue(undefined);
    mocks.useTransactionReview.mockReturnValue({
      data: sampleOrders,
      error: null,
      isLoading: false,
      isRefetching: false,
      refetch: vi.fn(),
    });
    mocks.useUpdateTransactionCostPrice.mockReturnValue({
      isPending: false,
      mutateAsync: mocks.mutateAsync,
    });
  });

  it('renders a loading state', () => {
    mocks.useTransactionReview.mockReturnValue({
      data: [],
      error: null,
      isLoading: true,
      isRefetching: false,
      refetch: vi.fn(),
    });

    render(<TransactionsScreen />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders a retryable error state when no transactions are available', () => {
    const refetch = vi.fn();
    mocks.useTransactionReview.mockReturnValue({
      data: [],
      error: new Error('boom'),
      isLoading: false,
      isRefetching: false,
      refetch,
    });

    render(<TransactionsScreen />);

    expect(
      screen.getByText('Unable to load transactions.')
    ).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Retry loading transactions'));
    expect(refetch).toHaveBeenCalled();
  });

  it('renders an empty state when there are no transactions', () => {
    mocks.useTransactionReview.mockReturnValue({
      data: [],
      error: null,
      isLoading: false,
      isRefetching: false,
      refetch: vi.fn(),
    });

    render(<TransactionsScreen />);

    expect(screen.getByText('No transactions yet.')).toBeInTheDocument();
  });

  it('shows a validation error before saving an invalid cost price', async () => {
    render(<TransactionsScreen />);

    fireEvent.click(screen.getByText('Edit ORD-1'));
    fireEvent.change(screen.getByLabelText('Cost price input'), {
      target: { value: 'abc' },
    });
    fireEvent.click(screen.getByText('Save cost price'));

    expect(
      await screen.findByText('Enter a valid cost price (0 or greater).')
    ).toBeInTheDocument();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it('saves a valid cost price update', async () => {
    render(<TransactionsScreen />);

    fireEvent.click(screen.getByText('Edit ORD-1'));
    fireEvent.change(screen.getByLabelText('Cost price input'), {
      target: { value: '1200' },
    });
    fireEvent.click(screen.getByText('Save cost price'));

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        costPrice: 1200,
        productId: 'product-1',
      })
    );
  });

  it('shows the async save error and keeps the editor actionable', async () => {
    mocks.mutateAsync.mockRejectedValueOnce(new Error('save failed'));

    render(<TransactionsScreen />);

    fireEvent.click(screen.getByText('Edit ORD-1'));
    fireEvent.change(screen.getByLabelText('Cost price input'), {
      target: { value: '1200' },
    });
    fireEvent.click(screen.getByText('Save cost price'));

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        costPrice: 1200,
        productId: 'product-1',
      })
    );

    expect(await screen.findByText('save failed')).toBeInTheDocument();
    expect(screen.getByText('Save cost price')).toBeInTheDocument();
  });
});
