import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NewOrderController } from '@/hooks/useNewOrderController';

const mocks = vi.hoisted(() => ({
  searchViewProps: [] as Array<{
    listBottomPadding?: number;
    showInlineSearch?: boolean;
  }>,
  sheetFrameProps: [] as Array<{
    activeIndex?: number;
    enableContentPanningGesture?: boolean;
    footerBottomInset?: number;
    snapPoints?: string[];
  }>,
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,
  default: ({ name }: { name: string }) => <span>{name}</span>,
  __esModule: true,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StatusBar: () => null,
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

vi.mock('./NewOrderProductPickerSheetFrame', () => ({
  NewOrderProductPickerSheetFrame: ({
    activeIndex,
    children,
    closeLabel,
    enableContentPanningGesture,
    footer,
    footerBottomInset,
    leadingAccessory,
    onClose,
    snapPoints,
    title,
    trailingAccessory,
    visible,
  }: {
    activeIndex?: number;
    children?: React.ReactNode;
    closeLabel: string;
    enableContentPanningGesture?: boolean;
    footer?: React.ReactNode;
    footerBottomInset?: number;
    leadingAccessory?: React.ReactNode;
    onClose: () => void;
    snapPoints?: string[];
    title: string;
    trailingAccessory?: React.ReactNode;
    visible: boolean;
  }) => {
    mocks.sheetFrameProps.push({
      activeIndex,
      enableContentPanningGesture,
      footerBottomInset,
      snapPoints,
    });

    return visible ? (
      <section aria-label="customer-sheet">
        {leadingAccessory ?? (
          <button aria-label={closeLabel} onClick={onClose} type="button">
            Close
          </button>
        )}
        <h1>{title}</h1>
        {trailingAccessory}
        {children}
        <footer>{footer}</footer>
      </section>
    ) : null;
  },
}));

vi.mock('./NewOrderCustomerSearchFooter', () => ({
  NewOrderCustomerSearchFooter: ({
    autoFocus,
    customerSearch,
  }: {
    autoFocus?: boolean;
    customerSearch: string;
  }) => (
    <input
      aria-label="Search customers"
      data-autofocus={String(Boolean(autoFocus))}
      readOnly
      value={customerSearch}
    />
  ),
}));

vi.mock('./NewOrderCustomerCreateView', async () => {
  const { Text } = await import('react-native');

  return {
    NewOrderCustomerCreateView: () => <Text>create-view</Text>,
  };
});

vi.mock('./NewOrderCustomerSearchView', () => ({
  NewOrderCustomerSearchView: ({
    listBottomPadding,
    showInlineSearch,
  }: {
    listBottomPadding?: number;
    showInlineSearch?: boolean;
  }) => {
    mocks.searchViewProps.push({ listBottomPadding, showInlineSearch });
    return <span>search-view</span>;
  },
}));

import { NewOrderCustomerSheet } from './NewOrderCustomerSheet';

type CustomerSheetController = Pick<
  NewOrderController,
  | 'colors'
  | 'customerSearch'
  | 'handleCloseCustomerModal'
  | 'isCreatingCustomer'
  | 'resetNewCustomerForm'
  | 'setCustomerSearch'
  | 'setDuplicateCustomer'
  | 'setIsCreatingCustomer'
  | 'showCustomerModal'
>;

function makeController(
  overrides: Partial<CustomerSheetController> = {}
): NewOrderController {
  return {
    colors: {
      background: '#050713',
      border: '#26283a',
      card: '#18192a',
      primary: '#2563eb',
      text: '#f8fafc',
      textMuted: '#94a3b8',
      ...overrides.colors,
    },
    customerSearch: '',
    handleCloseCustomerModal: vi.fn(),
    isCreatingCustomer: false,
    resetNewCustomerForm: vi.fn(),
    setDuplicateCustomer: vi.fn(),
    setIsCreatingCustomer: vi.fn(),
    setCustomerSearch: vi.fn(),
    showCustomerModal: true,
    ...overrides,
  } as NewOrderController;
}

describe('NewOrderCustomerSheet', () => {
  beforeEach(() => {
    mocks.searchViewProps.length = 0;
    mocks.sheetFrameProps.length = 0;
  });

  it('renders the search view in selection mode and forwards close actions', () => {
    const controller = makeController();

    render(<NewOrderCustomerSheet controller={controller} />);

    expect(screen.getByText('Select Customer')).toBeInTheDocument();
    expect(screen.getByText('search-view')).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', { name: 'Search customers' })
    ).toHaveAttribute('data-autofocus', 'true');
    expect(mocks.searchViewProps.at(-1)).toMatchObject({
      listBottomPadding: 128,
      showInlineSearch: false,
    });
    expect(mocks.sheetFrameProps.at(-1)).toMatchObject({
      activeIndex: 0,
      footerBottomInset: 18,
      snapPoints: ['40%', '74%'],
    });
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
    expect(screen.queryByText('Back to search')).not.toBeInTheDocument();
    // Snap points stay static across modes (no runtime mutation).
    expect(mocks.sheetFrameProps.at(-1)).toMatchObject({
      activeIndex: 1,
      snapPoints: ['40%', '74%'],
    });
    expect(
      screen.getByRole('button', { name: 'Close customer sheet' })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Back to customer search' })
    );

    expect(controller.setIsCreatingCustomer).toHaveBeenCalledWith(false);
    expect(controller.setDuplicateCustomer).toHaveBeenCalledWith(null);
    expect(controller.resetNewCustomerForm).toHaveBeenCalledTimes(1);
  });
});
