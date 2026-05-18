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
    TextInput: ({
      accessibilityLabel,
      onChangeText,
      placeholder,
      value,
    }: {
      accessibilityLabel?: string;
      onChangeText?: (value: string) => void;
      placeholder?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel ?? placeholder,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        placeholder,
        value: value ?? '',
      }),
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
    format: (amount: number) => `₦${amount.toLocaleString('en-US')}`,
    symbol: '₦',
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
    activeTab,
    estimatedProfitLabel,
    onTabChange,
    summary,
  }: {
    activeTab?: 'paid' | 'missing-costs';
    estimatedProfitLabel: string;
    onTabChange?: (tab: 'paid' | 'missing-costs') => void;
    summary: { missingCosts: number; transactions: number };
  }) => (
    <div>
      <button
        aria-pressed={activeTab === 'paid'}
        type="button"
        onClick={() => onTabChange?.('paid')}
      >
        Paid transactions tab
      </button>
      <button
        aria-pressed={activeTab === 'missing-costs'}
        type="button"
        onClick={() => onTabChange?.('missing-costs')}
      >
        Missing costs tab
      </button>
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
    onOpenEditor: (
      order: {
        createdAt: string;
        id: string;
      },
      item: {
        costPrice: number | null;
        id: string;
        name: string;
        productId: string | null;
        supplierName: string;
      }
    ) => void;
    order: {
      createdAt: string;
      id: string;
      items: Array<{
        costPrice: number | null;
        id: string;
        name: string;
        productId: string | null;
        supplierName: string;
      }>;
      orderNumber: string;
    };
  }) => (
    <div>
      <button type="button" onClick={() => onOpenEditor(order, order.items[0])}>
        Edit {order.orderNumber}
      </button>
      {order.items.map((item) => (
        <span key={item.id}>{item.name}</span>
      ))}
    </div>
  ),
}));

vi.mock('@/components/transactions/CostPriceEditorModal', () => ({
  CostPriceEditorModal: ({
    costPriceInput,
    dateInput,
    onChangeCostPrice,
    onChangeDate,
    onChangeSupplier,
    onClose,
    onSave,
    saveError,
    supplierInput,
    visible,
  }: {
    costPriceInput: string;
    dateInput?: string;
    onChangeCostPrice: (value: string) => void;
    onChangeDate?: (value: string) => void;
    onChangeSupplier?: (value: string) => void;
    onClose: () => void;
    onSave: () => void;
    saveError: string | null;
    supplierInput?: string;
    visible: boolean;
  }) =>
    visible ? (
      <div>
        <input
          aria-label="Cost price input"
          value={costPriceInput}
          onChange={(event) => onChangeCostPrice(event.target.value)}
        />
        <input
          aria-label="Transaction date input"
          value={dateInput ?? ''}
          onChange={(event) => onChangeDate?.(event.target.value)}
        />
        <input
          aria-label="Vendor or supplier input"
          value={supplierInput ?? ''}
          onChange={(event) => onChangeSupplier?.(event.target.value)}
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
import { buildTransactionDateIso } from '@/lib/transaction-review';

const sampleOrders = [
  {
    createdAt: '2026-04-10T10:00:00.000Z',
    customerEmail: null,
    customerName: 'Bassey',
    customerPhone: null,
    estimatedProfit: 3000,
    id: 'order-1',
    items: [
      {
        costPrice: null,
        imeiValues: ['353232106161443'],
        id: 'item-1',
        name: 'Samsung Galaxy S26',
        productId: 'product-1',
        profit: null,
        quantity: 1,
        revenue: 5000,
        searchText:
          'samsung galaxy s26 bassey 353232106161443 sn-123 old supplier',
        serialValues: ['SN-123'],
        sku: 'SG-S26',
        supplierName: 'Old Supplier',
      },
      {
        costPrice: 4000,
        imeiValues: [],
        id: 'item-known',
        name: 'Known Cost Accessory',
        productId: 'product-known',
        profit: 1000,
        quantity: 1,
        revenue: 5000,
        searchText: 'known cost accessory',
        serialValues: [],
        sku: 'KNOWN',
        supplierName: 'Known Supplier',
      },
    ],
    missingCostCount: 1,
    orderNumber: 'ORD-1',
    paymentMethod: 'card',
    searchText:
      'ord-1 bassey samsung galaxy s26 353232106161443 sn-123 old supplier',
    total: 5000,
  },
  {
    createdAt: '2026-04-09T10:00:00.000Z',
    customerEmail: null,
    customerName: 'Efosa',
    customerPhone: null,
    estimatedProfit: 1000,
    id: 'order-2',
    items: [
      {
        costPrice: 2000,
        imeiValues: [],
        id: 'item-2',
        name: 'Itel Buds Neo 3',
        productId: 'product-2',
        profit: 1000,
        quantity: 1,
        revenue: 3000,
        searchText: 'itel buds neo 3 efosa',
        serialValues: [],
        sku: null,
        supplierName: '',
      },
    ],
    missingCostCount: 0,
    orderNumber: 'ORD-2',
    paymentMethod: 'transfer',
    searchText: 'ord-2 efosa itel buds neo 3',
    total: 3000,
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

  it('shows a validation error before saving a negative cost price', async () => {
    render(<TransactionsScreen />);

    fireEvent.click(screen.getByText('Edit ORD-1'));
    fireEvent.change(screen.getByLabelText('Cost price input'), {
      target: { value: '-1200' },
    });
    fireEvent.click(screen.getByText('Save cost price'));

    expect(
      await screen.findByText('Enter a valid cost price (0 or greater).')
    ).toBeInTheDocument();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it('saves a valid cost price update', async () => {
    const expectedTransactionDateIso = buildTransactionDateIso('2026-04-12');

    render(<TransactionsScreen />);

    fireEvent.click(screen.getByText('Edit ORD-1'));
    fireEvent.change(screen.getByLabelText('Cost price input'), {
      target: { value: '₦1,200' },
    });
    fireEvent.change(screen.getByLabelText('Transaction date input'), {
      target: { value: '2026-04-12' },
    });
    fireEvent.change(screen.getByLabelText('Vendor or supplier input'), {
      target: { value: 'new supplier' },
    });
    fireEvent.click(screen.getByText('Save cost price'));

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        costPrice: 1200,
        orderId: 'order-1',
        productId: 'product-1',
        supplierName: 'New supplier',
        transactionDateIso: expectedTransactionDateIso,
      })
    );
  });

  it('opens existing cost prices with currency symbol and comma formatting', () => {
    render(<TransactionsScreen />);

    fireEvent.click(screen.getByText('Edit ORD-2'));

    expect(screen.getByLabelText('Cost price input')).toHaveValue('₦2,000');
  });

  it('filters visible transactions by IMEI', () => {
    render(<TransactionsScreen />);

    fireEvent.change(screen.getByLabelText('Search transactions'), {
      target: { value: '353232106161443' },
    });

    expect(screen.getByText('Edit ORD-1')).toBeInTheDocument();
    expect(screen.queryByText('Edit ORD-2')).not.toBeInTheDocument();
  });

  it('filters visible transactions by serial number', () => {
    render(<TransactionsScreen />);

    fireEvent.change(screen.getByLabelText('Search transactions'), {
      target: { value: 'SN-123' },
    });

    expect(screen.getByText('Edit ORD-1')).toBeInTheDocument();
    expect(screen.queryByText('Edit ORD-2')).not.toBeInTheDocument();
  });

  it('filters visible transactions by customer name', () => {
    render(<TransactionsScreen />);

    fireEvent.change(screen.getByLabelText('Search transactions'), {
      target: { value: 'Efosa' },
    });

    expect(screen.queryByText('Edit ORD-1')).not.toBeInTheDocument();
    expect(screen.getByText('Edit ORD-2')).toBeInTheDocument();
  });

  it('filters visible transactions by supplier name', () => {
    render(<TransactionsScreen />);

    fireEvent.change(screen.getByLabelText('Search transactions'), {
      target: { value: 'Old Supplier' },
    });

    expect(screen.getByText('Edit ORD-1')).toBeInTheDocument();
    expect(screen.queryByText('Edit ORD-2')).not.toBeInTheDocument();
  });

  it('filters visible transactions by product name', () => {
    render(<TransactionsScreen />);

    fireEvent.change(screen.getByLabelText('Search transactions'), {
      target: { value: 'Galaxy' },
    });

    expect(screen.getByText('Edit ORD-1')).toBeInTheDocument();
    expect(screen.queryByText('Edit ORD-2')).not.toBeInTheDocument();
  });

  it('switches between paid and missing-cost transaction tabs', () => {
    render(<TransactionsScreen />);

    expect(screen.getByText('Edit ORD-1')).toBeInTheDocument();
    expect(screen.getByText('Edit ORD-2')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Missing costs tab'));

    expect(screen.getByText('Edit ORD-1')).toBeInTheDocument();
    expect(screen.queryByText('Known Cost Accessory')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit ORD-2')).not.toBeInTheDocument();
  });

  it('shows the async save error and keeps the editor actionable', async () => {
    const expectedTransactionDateIso = buildTransactionDateIso('2026-04-10');
    mocks.mutateAsync.mockRejectedValueOnce(new Error('save failed'));

    render(<TransactionsScreen />);

    fireEvent.click(screen.getByText('Edit ORD-1'));
    fireEvent.change(screen.getByLabelText('Cost price input'), {
      target: { value: '₦1,200' },
    });
    fireEvent.click(screen.getByText('Save cost price'));

    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({
        costPrice: 1200,
        orderId: 'order-1',
        productId: 'product-1',
        supplierName: 'Old supplier',
        transactionDateIso: expectedTransactionDateIso,
      })
    );

    expect(await screen.findByText('save failed')).toBeInTheDocument();
    expect(screen.getByText('Save cost price')).toBeInTheDocument();
  });
});
