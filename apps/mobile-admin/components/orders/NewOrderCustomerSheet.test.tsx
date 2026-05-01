import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { useNewOrderController } from '@/hooks/useNewOrderController';

vi.mock('@/components/ui/AppPageSheet', () => ({
  AppPageSheet: ({
    children,
    onClose,
    title,
    trailingAccessory,
    visible,
  }: {
    children?: React.ReactNode;
    onClose: () => void;
    title: string;
    trailingAccessory?: React.ReactNode;
    visible: boolean;
  }) =>
    visible ? (
      <section aria-label="customer-sheet">
        <button
          aria-label="Close customer sheet"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
        <h1>{title}</h1>
        {trailingAccessory}
        {children}
      </section>
    ) : null,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
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
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
  };
});

vi.mock('./NewOrderCustomerCreateView', () => ({
  NewOrderCustomerCreateView: () => <div>create-view</div>,
}));

vi.mock('./NewOrderCustomerSearchView', () => ({
  NewOrderCustomerSearchView: () => <div>search-view</div>,
}));

import { NewOrderCustomerSheet } from './NewOrderCustomerSheet';

type CustomerSheetController = Pick<
  ReturnType<typeof useNewOrderController>,
  | 'colors'
  | 'handleCloseCustomerModal'
  | 'isCreatingCustomer'
  | 'resetNewCustomerForm'
  | 'setDuplicateCustomer'
  | 'setIsCreatingCustomer'
  | 'showCustomerModal'
>;

function makeController(
  overrides: Partial<CustomerSheetController> = {}
): ReturnType<typeof useNewOrderController> {
  return {
    colors: {
      primary: '#2563eb',
      ...overrides.colors,
    },
    handleCloseCustomerModal: vi.fn(),
    isCreatingCustomer: false,
    resetNewCustomerForm: vi.fn(),
    setDuplicateCustomer: vi.fn(),
    setIsCreatingCustomer: vi.fn(),
    showCustomerModal: true,
    ...overrides,
  } as ReturnType<typeof useNewOrderController>;
}

describe('NewOrderCustomerSheet', () => {
  it('renders the search view in selection mode and forwards close actions', () => {
    const controller = makeController();

    render(<NewOrderCustomerSheet controller={controller} />);

    expect(screen.getByText('Select Customer')).toBeInTheDocument();
    expect(screen.getByText('search-view')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Back to customer search' })
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Close customer sheet' })
    );

    expect(controller.handleCloseCustomerModal).toHaveBeenCalledTimes(1);
  });

  it('renders the create view and supports navigating back to search', () => {
    const controller = makeController({ isCreatingCustomer: true });

    render(<NewOrderCustomerSheet controller={controller} />);

    expect(screen.getByText('New Customer')).toBeInTheDocument();
    expect(screen.getByText('create-view')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Back to customer search' })
    );

    expect(controller.setIsCreatingCustomer).toHaveBeenCalledWith(false);
    expect(controller.setDuplicateCustomer).toHaveBeenCalledWith(null);
    expect(controller.resetNewCustomerForm).toHaveBeenCalledTimes(1);
  });
});
