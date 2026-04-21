import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import { NewOrderCustomerSearchView } from './NewOrderCustomerSearchView';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    FlatList: ({
      ListFooterComponent,
      ListEmptyComponent,
      data,
      renderItem,
    }: {
      ListFooterComponent?: React.ReactNode;
      ListEmptyComponent?: React.ReactNode;
      data: Array<unknown>;
      renderItem: (item: { item: unknown }) => React.ReactNode;
    }) =>
      React.createElement(
        'div',
        null,
        data.length === 0
          ? ListEmptyComponent
          : data.map((item, index) => (
              <div key={String(index)}>{renderItem({ item })}</div>
            )),
        ListFooterComponent
      ),
    Pressable: ({
      accessibilityLabel,
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          onClick: () => onPress?.(),
          type: 'button',
        },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      onChangeText,
      placeholder,
      value,
    }: {
      onChangeText?: (value: string) => void;
      placeholder?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        placeholder,
        value: value ?? '',
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

type CustomerSearchController = Pick<
  ReturnType<typeof useNewOrderController>,
  | 'colors'
  | 'customerSearch'
  | 'customersData'
  | 'customersQuery'
  | 'handleSelectCustomer'
  | 'setCustomerSearch'
  | 'setIsCreatingCustomer'
>;

function makeController(
  overrides: Partial<CustomerSearchController> = {}
): ReturnType<typeof useNewOrderController> {
  return {
    colors: {
      border: '#e2e8f0',
      cardHover: '#f8fafc',
      primary: '#2563eb',
      success: '#16a34a',
      text: '#0f172a',
      textMuted: '#94a3b8',
      textSecondary: '#64748b',
      ...overrides.colors,
    },
    customerSearch: '',
    customersData: { pages: [] },
    customersQuery: {
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    } as unknown as CustomerSearchController['customersQuery'],
    handleSelectCustomer: vi.fn(),
    setCustomerSearch: vi.fn(),
    setIsCreatingCustomer: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useNewOrderController>;
}

describe('NewOrderCustomerSearchView', () => {
  it('shows the empty state and forwards search/create interactions', () => {
    const controller = makeController();

    render(<NewOrderCustomerSearchView controller={controller} />);

    expect(screen.getByText('No customers found')).toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText('Search name, email, or phone...'),
      {
        target: { value: 'Ada' },
      }
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Create new customer' })
    );

    expect(controller.setCustomerSearch).toHaveBeenCalledWith('Ada');
    expect(controller.setIsCreatingCustomer).toHaveBeenCalledWith(true);
  });

  it('renders customer rows with shared fallback display helpers', () => {
    const customerWithPhoneOnly = {
      address: null,
      created_at: '',
      deleted_at: null,
      email: null,
      first_name: null,
      full_name: null,
      id: 'customer-1',
      last_login_at: null,
      last_name: null,
      loyalty_points: 0,
      merchant_id: 'merchant-1',
      phone: '08012345678',
      store_credit: 0,
      total_orders: 2,
      total_spent: 0,
      updated_at: '',
    };
    const controller = makeController({
      customersData: {
        pageParams: [0],
        pages: [{ customers: [customerWithPhoneOnly], nextCursor: null, totalCount: 1 }],
      },
    });

    render(<NewOrderCustomerSearchView controller={controller} />);

    expect(
      screen.getByRole('button', { name: 'Select customer 08012345678' })
    ).toBeInTheDocument();
    expect(screen.getAllByText('08012345678')).toHaveLength(2);
    expect(screen.getByText('2 orders')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Select customer 08012345678' })
    );

    expect(controller.handleSelectCustomer).toHaveBeenCalledWith(
      customerWithPhoneOnly
    );
  });

  it('renders a load-more footer and forwards pagination actions', () => {
    const customersQuery = {
      fetchNextPage: vi.fn(),
      hasNextPage: true,
      isFetchingNextPage: false,
    } as unknown as CustomerSearchController['customersQuery'];
    const controller = makeController({
      customersData: {
        pageParams: [0],
        pages: [{ customers: [], nextCursor: 20, totalCount: 20 }],
      },
      customersQuery,
    });

    render(<NewOrderCustomerSearchView controller={controller} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Load more customers' })
    );

    expect(customersQuery.fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('shows the loading footer while fetching more customers', () => {
    const controller = makeController({
      customersData: {
        pageParams: [0],
        pages: [{ customers: [], nextCursor: 20, totalCount: 20 }],
      },
      customersQuery: {
        fetchNextPage: vi.fn(),
        hasNextPage: true,
        isFetchingNextPage: true,
      } as unknown as CustomerSearchController['customersQuery'],
    });

    render(<NewOrderCustomerSearchView controller={controller} />);

    expect(screen.getByText('Loading more customers...')).toBeInTheDocument();
  });
});
