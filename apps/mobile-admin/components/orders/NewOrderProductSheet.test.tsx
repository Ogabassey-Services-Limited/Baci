import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import { NewOrderProductSheet } from './NewOrderProductSheet';

const routerState = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock('expo-router', () => ({
  router: {
    push: routerState.push,
  },
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

vi.mock('@/components/ui/AppPageSheet', () => ({
  AppPageSheet: ({
    children,
    closeLabel,
    onClose,
    title,
    trailingAccessory,
    visible,
  }: {
    children?: React.ReactNode;
    closeLabel: string;
    onClose: () => void;
    title: string;
    trailingAccessory?: React.ReactNode;
    visible: boolean;
  }) =>
    visible ? (
      <section aria-label="product-sheet">
        <button aria-label={closeLabel} onClick={onClose} type="button" />
        <h1>{title}</h1>
        {trailingAccessory}
        {children}
      </section>
    ) : null,
}));

vi.mock('./NewOrderProductSheetEmptyState', () => ({
  NewOrderProductSheetEmptyState: () => <div>product-empty-state</div>,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: () =>
      React.createElement('div', { role: 'progressbar' }, 'loading'),
    FlatList: ({
      ListEmptyComponent,
      ListFooterComponent,
      data,
      onEndReached,
      renderItem,
    }: {
      ListEmptyComponent?: React.ReactNode;
      ListFooterComponent?: React.ReactNode;
      data: unknown[];
      onEndReached?: () => void;
      renderItem: (item: { item: unknown }) => React.ReactNode;
    }) =>
      React.createElement(
        'div',
        null,
        data.length === 0
          ? ListEmptyComponent
          : data.map((item, index) =>
              React.createElement(
                'div',
                { key: String(index) },
                renderItem({ item })
              )
            ),
        ListFooterComponent,
        React.createElement(
          'button',
          {
            'aria-label': 'Reach list end',
            onClick: () => onEndReached?.(),
            type: 'button',
          },
          'Reach list end'
        )
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
        'aria-label': placeholder,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        value: value ?? '',
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

type ProductSheetController = Pick<
  ReturnType<typeof useNewOrderController>,
  | 'closeProductModal'
  | 'colors'
  | 'fetchMoreProducts'
  | 'formatPrice'
  | 'handleAddProduct'
  | 'handleSelectProduct'
  | 'hasMoreProducts'
  | 'isFetchingMoreProducts'
  | 'isPickingVariant'
  | 'productSearch'
  | 'resetProductPickerState'
  | 'selectableProductRows'
  | 'selectedParentProduct'
  | 'setProductSearch'
  | 'showProductModal'
>;

function makeController(
  overrides: Partial<ProductSheetController> = {}
): ReturnType<typeof useNewOrderController> {
  return {
    closeProductModal: vi.fn(),
    colors: {
      border: '#e2e8f0',
      card: '#ffffff',
      cardHover: '#f1f5f9',
      primary: '#2563eb',
      text: '#0f172a',
      textMuted: '#94a3b8',
      textSecondary: '#64748b',
    },
    fetchMoreProducts: vi.fn(),
    formatPrice: (amount: number) => `₦${amount}`,
    handleAddProduct: vi.fn(),
    handleSelectProduct: vi.fn(),
    hasMoreProducts: true,
    isFetchingMoreProducts: false,
    isPickingVariant: false,
    productSearch: '',
    resetProductPickerState: vi.fn(),
    selectableProductRows: [
      {
        condition: 'brand_new',
        id: 'product-1',
        images: ['https://example.com/phone.png'],
        name: 'Baci Phone',
        price: 2500,
        sku: 'SKU-1',
        variant_attributes: [],
      },
    ],
    selectedParentProduct: null,
    setProductSearch: vi.fn(),
    showProductModal: true,
    ...overrides,
  } as ReturnType<typeof useNewOrderController>;
}

describe('NewOrderProductSheet', () => {
  it('renders product search mode and forwards search, create, select, and pagination actions', () => {
    const controller = makeController();

    render(<NewOrderProductSheet controller={controller} />);

    fireEvent.change(
      screen.getByRole('textbox', { name: 'Search products...' }),
      {
        target: { value: 'Laptop' },
      }
    );
    fireEvent.click(
      screen.getByRole('button', { name: /create new product/i })
    );
    fireEvent.click(screen.getByRole('button', { name: /baci phone/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Reach list end' }));

    expect(controller.setProductSearch).toHaveBeenCalledWith('Laptop');
    expect(controller.closeProductModal).toHaveBeenCalledTimes(1);
    expect(routerState.push).toHaveBeenCalledWith('/product/new');
    expect(controller.handleSelectProduct).toHaveBeenCalledWith(
      controller.selectableProductRows[0]
    );
    expect(controller.fetchMoreProducts).toHaveBeenCalledTimes(1);
  });

  it('renders variant mode and adds the selected variant with fallback parent images', () => {
    const controller = makeController({
      isPickingVariant: true,
      selectableProductRows: [
        {
          condition: null,
          has_variants: false,
          id: 'variant-1',
          images: [],
          name: 'Baci Phone Blue',
          price: 3000,
          sku: 'SKU-BLUE',
          variant_attributes: [{ name: 'Color', value: 'Blue' }],
        },
      ],
      selectedParentProduct: {
        id: 'product-parent',
        images: ['https://example.com/parent.png'],
        name: 'Baci Phone',
      } as unknown as ProductSheetController['selectedParentProduct'],
    });

    render(<NewOrderProductSheet controller={controller} />);

    fireEvent.click(screen.getByRole('button', { name: /blue/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Reach list end' }));

    expect(controller.handleAddProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'variant-1',
        images: ['https://example.com/parent.png'],
      })
    );
    expect(controller.fetchMoreProducts).not.toHaveBeenCalled();
  });

  it('resets variant picking from the back control', () => {
    const controller = makeController({
      isPickingVariant: true,
      selectableProductRows: [],
    });

    render(<NewOrderProductSheet controller={controller} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Back to product list' })
    );

    expect(controller.resetProductPickerState).toHaveBeenCalledTimes(1);
  });

  it('renders empty and loading states through the list shell', () => {
    const controller = makeController({
      isFetchingMoreProducts: true,
      selectableProductRows: [],
    });

    render(<NewOrderProductSheet controller={controller} />);

    expect(screen.getByText('product-empty-state')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
