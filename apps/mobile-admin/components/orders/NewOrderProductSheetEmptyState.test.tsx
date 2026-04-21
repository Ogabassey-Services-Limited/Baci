import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import { NewOrderProductSheetEmptyState } from './NewOrderProductSheetEmptyState';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: () =>
      React.createElement('span', { role: 'progressbar' }, 'loading'),
    Pressable: ({
      children,
      onPress,
    }: {
      children?: ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        { onClick: () => onPress?.(), type: 'button' },
        children
      ),
    Text: ({ children }: { children?: ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', null, children),
  };
});

type EmptyStateController = Pick<
  ReturnType<typeof useNewOrderController>,
  | 'colors'
  | 'isLoadingSelectedParentProduct'
  | 'isPickingVariant'
  | 'isProductsLoading'
  | 'productSearch'
  | 'productsError'
  | 'refetchProducts'
  | 'refetchSelectedParentProduct'
  | 'selectedParentProductError'
>;

function makeController(
  overrides: Partial<EmptyStateController> = {}
): ReturnType<typeof useNewOrderController> {
  return {
    colors: {
      background: '#ffffff',
      primary: '#2563eb',
      textSecondary: '#64748b',
      ...overrides.colors,
    },
    isLoadingSelectedParentProduct: false,
    isPickingVariant: false,
    isProductsLoading: false,
    productSearch: '',
    productsError: null,
    refetchProducts: vi.fn(),
    refetchSelectedParentProduct: vi.fn(),
    selectedParentProductError: null,
    ...overrides,
  } as ReturnType<typeof useNewOrderController>;
}

describe('NewOrderProductSheetEmptyState', () => {
  it('renders a retry state for variant lookup errors', () => {
    const controller = makeController({
      isPickingVariant: true,
      selectedParentProductError: new Error('Variants failed'),
    });

    render(<NewOrderProductSheetEmptyState controller={controller} />);

    expect(screen.getByText('Variants failed')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(controller.refetchSelectedParentProduct).toHaveBeenCalledTimes(1);
  });

  it('renders a retry state for product lookup errors', () => {
    const controller = makeController({
      productsError: new Error('Products failed'),
    });

    render(<NewOrderProductSheetEmptyState controller={controller} />);

    expect(screen.getByText('Products failed')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(controller.refetchProducts).toHaveBeenCalledTimes(1);
  });

  it('switches between loading and empty-search states', () => {
    const loadingController = makeController({ isProductsLoading: true });

    const view = render(
      <NewOrderProductSheetEmptyState controller={loadingController} />
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    const searchController = makeController({ productSearch: 'phone' });
    view.rerender(
      <NewOrderProductSheetEmptyState controller={searchController} />
    );

    expect(
      screen.getByText('No products match that search yet.')
    ).toBeInTheDocument();
  });
});
