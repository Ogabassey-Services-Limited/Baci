import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ChangeEvent, ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NewOrderProductSheet } from './NewOrderProductSheet';

vi.mock('expo-router', () => ({
  router: { push: vi.fn() },
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: () => null,
  __esModule: true,
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 8, right: 0, bottom: 12, left: 0 }),
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
    children?: ReactNode;
    closeLabel: string;
    onClose: () => void;
    title: string;
    trailingAccessory?: ReactNode;
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
  NewOrderProductSheetEmptyState: () => <div role="status" />,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    useColorScheme: () => 'light',
    StatusBar: () => null,
    ActivityIndicator: () =>
      React.createElement('div', { role: 'progressbar' }, 'loading'),
    FlatList: ({
      ListEmptyComponent,
      ListFooterComponent,
      data,
      onEndReached,
      renderItem,
    }: {
      ListEmptyComponent?: ReactNode;
      ListFooterComponent?: ReactNode;
      data: unknown[];
      onEndReached?: () => void;
      renderItem: (item: { item: unknown }) => ReactNode;
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
      accessibilityState,
      children,
      disabled,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityState?: { disabled?: boolean; selected?: boolean };
      children?: ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-disabled': disabled || accessibilityState?.disabled,
          'aria-label': accessibilityLabel,
          'aria-pressed': accessibilityState?.selected,
          disabled,
          onClick: () => {
            if (!(disabled || accessibilityState?.disabled)) {
              onPress?.();
            }
          },
          type: 'button',
        },
        children
      ),
    ScrollView: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', null, children),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: ReactNode }) =>
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
        onChange: (event: ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        value: value ?? '',
      }),
    View: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', null, children),
  };
});

type ProductSheetController = ComponentProps<
  typeof NewOrderProductSheet
>['controller'];
type ProductSheetRow = ProductSheetController['selectableProductRows'][number];

function makeController(
  overrides: Partial<ProductSheetController> = {}
): ProductSheetController {
  return {
    closeProductModal: vi.fn(),
    colors: {
      background: '#ffffff',
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
    isLoadingSelectedParentProduct: false,
    isPickingVariant: true,
    isProductsLoading: false,
    productSearch: '',
    productsError: null,
    refetchProducts: vi.fn(),
    refetchSelectedParentProduct: vi.fn(),
    resetProductPickerState: vi.fn(),
    selectableProductRows: [],
    selectedParentProduct: null,
    selectedParentProductError: null,
    setProductSearch: vi.fn(),
    showProductModal: true,
    ...overrides,
  } as unknown as ProductSheetController;
}

const selectedParentProduct = {
  condition: 'brand_new',
  has_variants: true,
  id: 'product-parent',
  images: ['https://example.com/parent.png'],
  name: 'Baci Phone',
  parent_product_id: null,
  price: 3000,
  sku: 'SKU-PARENT',
  variant_attributes: [],
} satisfies NonNullable<ProductSheetController['selectedParentProduct']>;

function makeVariantRow(
  id: string,
  name: string,
  variant_attributes: ProductSheetRow['variant_attributes'],
  overrides: Partial<ProductSheetRow> = {}
): ProductSheetRow {
  return {
    condition: null,
    has_variants: false,
    id,
    images: [],
    name,
    parent_product_id: 'product-parent',
    price: 3000,
    sku: id.toUpperCase(),
    variant_attributes,
    ...overrides,
  };
}

describe('NewOrderProductSheet variant mode', () => {
  it('adds a structured variant after the user taps option chips', () => {
    const controller = makeController({
      selectableProductRows: [
        makeVariantRow('variant-1', 'Baci Phone Blue', {
          color: 'Blue',
          storage: '512GB',
        }),
        makeVariantRow('variant-2', 'Baci Phone Black', {
          color: 'Black',
          storage: '512GB',
        }),
      ],
      selectedParentProduct,
    });

    render(<NewOrderProductSheet controller={controller} />);

    fireEvent.click(screen.getByRole('button', { name: 'Select Color Blue' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Select Storage 512GB' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Add selected variant' })
    );

    expect(controller.handleAddProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'variant-1',
        images: ['https://example.com/parent.png'],
      })
    );
  });

  it('falls back to the flat variant list when rows have no selectable attributes', () => {
    const controller = makeController({
      selectableProductRows: [
        makeVariantRow('variant-1', 'Baci Phone Blue', null),
      ],
      selectedParentProduct,
    });

    render(<NewOrderProductSheet controller={controller} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Blue' }));

    expect(controller.handleAddProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'variant-1',
        images: ['https://example.com/parent.png'],
      })
    );
  });

  it('falls back when variant groups do not distinguish rows', () => {
    const controller = makeController({
      selectableProductRows: [
        makeVariantRow('variant-1', 'Baci Phone A', null, {
          condition: 'open_box',
        }),
        makeVariantRow('variant-2', 'Baci Phone B', null, {
          condition: 'open_box',
        }),
      ],
      selectedParentProduct,
    });

    render(<NewOrderProductSheet controller={controller} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add A' }));

    expect(controller.handleAddProduct).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'variant-1' })
    );
  });

  it('resets variant picking from the back control', () => {
    const controller = makeController();

    render(<NewOrderProductSheet controller={controller} />);

    fireEvent.click(
      screen.getByRole('button', { name: 'Back to product list' })
    );

    expect(controller.resetProductPickerState).toHaveBeenCalledTimes(1);
  });
});
