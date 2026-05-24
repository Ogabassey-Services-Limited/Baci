import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  keepCustomMutateAsync: vi.fn(),
  linkMutateAsync: vi.fn(),
  useUnlinkedOrderItemReconciliation: vi.fn(),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  type NativeProps = {
    accessibilityLabel?: string;
    accessibilityRole?: string;
    children?: React.ReactNode;
    disabled?: boolean;
    onPress?: () => void;
    style?: unknown;
  };

  return {
    ActivityIndicator: () =>
      React.createElement('div', { role: 'progressbar' }),
	    Pressable: ({
	      accessibilityLabel,
	      accessibilityRole,
	      children,
	      disabled,
	      onPress,
    }: NativeProps) =>
      React.createElement(
        'button',
	        {
	          'aria-label': accessibilityLabel,
	          disabled,
	          onClick: () => {
	            if (!disabled) {
	              onPress?.();
	            }
	          },
	          role: accessibilityRole,
	          type: 'button',
	        },
        children
      ),
    ScrollView: ({ children }: NativeProps) =>
      React.createElement('div', null, children),
    StyleSheet: {
      create: <T,>(styles: T) => styles,
      hairlineWidth: 1,
    },
    Text: ({ children }: NativeProps) =>
      React.createElement('span', null, children),
    View: ({ children }: NativeProps) =>
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
  };
});

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      error: '#dc2626',
      primary: '#2563eb',
      success: '#16a34a',
      text: '#111',
      textMuted: '#6b7280',
      textOnPrimary: '#fff',
      textSecondary: '#4b5563',
      warning: '#d97706',
    },
    isDark: false,
  }),
}));

vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({
    format: (amount: number) => `₦${amount.toLocaleString('en-US')}`,
  }),
}));

vi.mock('@/hooks/useUnlinkedOrderItemReconciliation', () => ({
  useUnlinkedOrderItemReconciliation:
    mocks.useUnlinkedOrderItemReconciliation,
}));

import TransactionReconciliationScreen from './transaction-reconciliation';

const unlinkedItems = [
  {
    cost_price: null,
    id: 'item-1',
    name: 'iPhone 11 Pro 64gb Premium Used [IMEI: 353232106161443]',
    orders: {
      created_at: '2026-05-11T10:00:00.000Z',
      customer_name: 'Olayinka Akerele',
      id: 'order-1',
      merchant_id: 'merchant-1',
      order_number: 'ORD-110526-74B115',
      payment_status: 'paid',
    },
    price: 180000,
    product_match_status: null,
    quantity: 1,
    supplier_name: null,
  },
];

const candidates = [
  {
    name: '64GB Premium Used',
    parentName: 'iPhone 11 Pro',
    price: 180000,
    productId: 'product-1',
    status: 'active',
    variantId: 'variant-1',
  },
  {
    name: 'Itel Buds Neo 3',
    parentName: null,
    price: 20000,
    productId: 'product-2',
    status: 'active',
    variantId: null,
  },
];

function mockReadyState() {
  mocks.useUnlinkedOrderItemReconciliation.mockReturnValue({
    keepCustomMutation: {
      isPending: false,
      mutateAsync: mocks.keepCustomMutateAsync,
    },
    linkItemMutation: {
      isPending: false,
      mutateAsync: mocks.linkMutateAsync,
    },
	    productCandidatesQuery: {
	      data: candidates,
	      error: null,
	      isLoading: false,
	      refetch: vi.fn(),
	    },
    unlinkedItemsQuery: {
      data: unlinkedItems,
      error: null,
      isLoading: false,
      refetch: vi.fn(),
    },
  });
}

describe('TransactionReconciliationScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.keepCustomMutateAsync.mockResolvedValue(undefined);
    mocks.linkMutateAsync.mockResolvedValue(undefined);
    mockReadyState();
  });

  it('shows suggested product and variant matches for unlinked transaction items', () => {
    render(<TransactionReconciliationScreen />);

    expect(screen.getByText('Olayinka Akerele')).toBeInTheDocument();
    expect(screen.getByText('ORD-110526-74B115')).toBeInTheDocument();
    expect(screen.getByText('iPhone 11 Pro 64GB Premium Used')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Link iPhone 11 Pro 64GB Premium Used' })
    ).toBeInTheDocument();
  });

  it('links an unlinked item to the selected catalog product or variant', async () => {
    render(<TransactionReconciliationScreen />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Link iPhone 11 Pro 64GB Premium Used' })
    );

    await waitFor(() =>
      expect(mocks.linkMutateAsync).toHaveBeenCalledWith({
        orderItemId: 'item-1',
        productId: 'product-1',
        variantId: 'variant-1',
      })
    );
  });

  it('lets the merchant keep an unlinked item as custom', async () => {
    render(<TransactionReconciliationScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Keep item custom' }));

    await waitFor(() =>
      expect(mocks.keepCustomMutateAsync).toHaveBeenCalledWith({
        orderItemId: 'item-1',
      })
    );
  });

  it('renders an empty state when there is no product drift to review', () => {
    mocks.useUnlinkedOrderItemReconciliation.mockReturnValueOnce({
      keepCustomMutation: {
        isPending: false,
        mutateAsync: mocks.keepCustomMutateAsync,
      },
      linkItemMutation: {
        isPending: false,
        mutateAsync: mocks.linkMutateAsync,
      },
	      productCandidatesQuery: {
	        data: [],
	        error: null,
	        isLoading: false,
	        refetch: vi.fn(),
	      },
      unlinkedItemsQuery: {
        data: [],
        error: null,
        isLoading: false,
        refetch: vi.fn(),
      },
    });

    render(<TransactionReconciliationScreen />);

	    expect(screen.getByText('No unmatched transaction items.')).toBeInTheDocument();
	  });

	  it('retries both reconciliation queries when loading fails', () => {
	    const refetchProducts = vi.fn();
	    const refetchUnlinkedItems = vi.fn();
	    mocks.useUnlinkedOrderItemReconciliation.mockReturnValueOnce({
	      keepCustomMutation: {
	        isPending: false,
	        mutateAsync: mocks.keepCustomMutateAsync,
	      },
	      linkItemMutation: {
	        isPending: false,
	        mutateAsync: mocks.linkMutateAsync,
	      },
	      productCandidatesQuery: {
	        data: [],
	        error: new Error('Product candidates failed'),
	        isLoading: false,
	        refetch: refetchProducts,
	      },
	      unlinkedItemsQuery: {
	        data: [],
	        error: null,
	        isLoading: false,
	        refetch: refetchUnlinkedItems,
	      },
	    });

	    render(<TransactionReconciliationScreen />);

	    expect(screen.getByText('Unable to load unmatched items.')).toBeInTheDocument();

	    fireEvent.click(
	      screen.getByRole('button', {
	        name: 'Retry unmatched item reconciliation',
	      })
	    );

	    expect(refetchUnlinkedItems).toHaveBeenCalledTimes(1);
	    expect(refetchProducts).toHaveBeenCalledTimes(1);
	  });

	  it('surfaces link errors to the merchant', async () => {
	    mocks.linkMutateAsync.mockRejectedValueOnce(new Error('link failed'));

	    render(<TransactionReconciliationScreen />);

	    fireEvent.click(
	      screen.getByRole('button', { name: 'Link iPhone 11 Pro 64GB Premium Used' })
	    );

	    expect(await screen.findByText('link failed')).toBeInTheDocument();
	  });

	  it('surfaces keep-custom errors to the merchant', async () => {
	    mocks.keepCustomMutateAsync.mockRejectedValueOnce(
	      new Error('custom failed')
	    );

	    render(<TransactionReconciliationScreen />);

	    fireEvent.click(screen.getByRole('button', { name: 'Keep item custom' }));

	    expect(await screen.findByText('custom failed')).toBeInTheDocument();
	  });
	});
