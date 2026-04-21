import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NewOrderProductSheetEmptyState } from './NewOrderProductSheetEmptyState';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: ({ testID }: { testID?: string }) =>
      React.createElement('div', {
        'data-testid': testID ?? 'activity-indicator',
      }),
    Pressable: ({
      children,
      onPress,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        { onClick: () => onPress?.(), type: 'button' },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

type ControllerShape = {
  colors: {
    background: string;
    primary: string;
    textSecondary: string;
  };
  isLoadingSelectedParentProduct: boolean;
  isPickingVariant: boolean;
  isProductsLoading: boolean;
  productSearch: string;
  productsError: Error | null;
  refetchProducts: ReturnType<typeof vi.fn>;
  refetchSelectedParentProduct: ReturnType<typeof vi.fn>;
  selectedParentProductError: Error | null;
};

const makeController = (
  overrides: Partial<ControllerShape> = {}
): ControllerShape => ({
  colors: {
    background: '#ffffff',
    primary: '#2563eb',
    textSecondary: '#64748b',
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
});

describe('NewOrderProductSheetEmptyState', () => {
  it('renders the default empty state when no products are available', () => {
    const controller = makeController();

    render(
      <NewOrderProductSheetEmptyState
        controller={
          controller as unknown as React.ComponentProps<
            typeof NewOrderProductSheetEmptyState
          >['controller']
        }
      />
    );

    expect(screen.getByText('No products available yet.')).toBeInTheDocument();
  });

  it('renders a search-specific message when productSearch has a value', () => {
    const controller = makeController({ productSearch: 'shoes' });

    render(
      <NewOrderProductSheetEmptyState
        controller={
          controller as unknown as React.ComponentProps<
            typeof NewOrderProductSheetEmptyState
          >['controller']
        }
      />
    );

    expect(
      screen.getByText('No products match that search yet.')
    ).toBeInTheDocument();
  });

  it('renders the variant empty state when picking a variant with no variants', () => {
    const controller = makeController({ isPickingVariant: true });

    render(
      <NewOrderProductSheetEmptyState
        controller={
          controller as unknown as React.ComponentProps<
            typeof NewOrderProductSheetEmptyState
          >['controller']
        }
      />
    );

    expect(
      screen.getByText(
        'No sellable variants are available for this product yet.'
      )
    ).toBeInTheDocument();
  });

  it('renders the products error state with a Retry button when productsError is set', () => {
    const controller = makeController({
      productsError: new Error('Network error'),
    });

    render(
      <NewOrderProductSheetEmptyState
        controller={
          controller as unknown as React.ComponentProps<
            typeof NewOrderProductSheetEmptyState
          >['controller']
        }
      />
    );

    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('renders the variant error state with a Retry button when selectedParentProductError is set', () => {
    const controller = makeController({
      isPickingVariant: true,
      selectedParentProductError: new Error('Variants unavailable'),
    });

    render(
      <NewOrderProductSheetEmptyState
        controller={
          controller as unknown as React.ComponentProps<
            typeof NewOrderProductSheetEmptyState
          >['controller']
        }
      />
    );

    expect(screen.getByText('Variants unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
