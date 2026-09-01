import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  NewOrderProductSheet,
  type NewOrderProductSheetController,
} from './NewOrderProductSheet';
import type { SelectableOrderProduct } from './new-order.types';

vi.mock('expo-router', () => ({
  router: { push: vi.fn() },
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: () => null,
  __esModule: true,
}));

vi.mock('@/components/orders/NewOrderProductPickerSheetFrame', () => ({
  NewOrderProductPickerSheetFrame: ({
    children,
    closeLabel,
    footer,
    leadingAccessory,
    onClose,
    title,
    trailingAccessory,
    visible,
  }: {
    children?: ReactNode;
    closeLabel: string;
    footer?: ReactNode;
    leadingAccessory?: ReactNode;
    onClose: () => void;
    title: string;
    trailingAccessory?: ReactNode;
    visible: boolean;
  }) =>
    visible ? (
      <section aria-label="product-page-sheet">
        <div data-testid="product-sheet-leading-accessory">
          {leadingAccessory ?? (
            <button aria-label={closeLabel} onClick={onClose} type="button" />
          )}
        </div>
        <h1>{title}</h1>
        <div data-testid="product-sheet-trailing-accessory">
          {trailingAccessory}
        </div>
        {children}
        {footer}
      </section>
    ) : null,
}));

vi.mock('./NewOrderProductSheetEmptyState', () => ({
  NewOrderProductSheetEmptyState: () => <div role="status">empty</div>,
}));

vi.mock('@gorhom/bottom-sheet', async () => {
  const React = await import('react');

  return {
    BottomSheetFlatList: ({
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
    BottomSheetScrollView: ({
      children,
      testID,
    }: {
      children?: ReactNode;
      testID?: string;
    }) => React.createElement('div', { 'data-testid': testID }, children),
    BottomSheetTextInput: () => null,
  };
});

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    useColorScheme: () => 'light',
    StatusBar: () => null,
    ActivityIndicator: () =>
      React.createElement('div', { role: 'progressbar' }, 'loading'),
    Platform: {
      OS: 'ios',
      select: (objs: Record<string, unknown>) => objs.ios || objs.default,
    },
    InteractionManager: {
      runAfterInteractions: (callback: () => void) => {
        callback();
        return { cancel: vi.fn() };
      },
    },
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
    View: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', null, children),
  };
});

function makeController(
  overrides: Partial<NewOrderProductSheetController> = {}
): NewOrderProductSheetController {
  return {
    closeProductModal: vi.fn(),
    colors: {
      background: '#ffffff',
      backgroundLight: '#f8fafc',
      border: '#e2e8f0',
      card: '#ffffff',
      cardHover: '#f1f5f9',
      primary: '#2563eb',
      text: '#0f172a',
      textMuted: '#94a3b8',
      textOnPrimary: '#ffffff',
      textSecondary: '#64748b',
    } as NewOrderProductSheetController['colors'],
    fetchMoreProducts: vi.fn(),
    formatPrice: (amount: number) => `₦${amount}`,
    handleAddProduct: vi.fn(),
    handleSelectProduct: vi.fn(),
    hasMoreProducts: true,
    isFetchingMoreProducts: false,
    isLoadingSelectedParentProduct: false,
    isPickingVariant: true,
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
  } as NewOrderProductSheetController;
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
} satisfies SelectableOrderProduct;

type ProductSheetRow =
  NewOrderProductSheetController['selectableProductRows'][number];

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
  it('uses the grouped option selector to add a selected variant with fallback parent images', () => {
    const controller = makeController({
      selectableProductRows: [
        makeVariantRow('variant-1', 'Baci Phone Blue 512GB', [
          { name: 'Color', value: 'Blue' },
          { name: 'Storage', value: '512GB' },
        ]),
        makeVariantRow('variant-2', 'Baci Phone Black 256GB', [
          { name: 'Color', value: 'Black' },
          { name: 'Storage', value: '256GB' },
        ]),
      ],
      selectedParentProduct,
    });

    render(<NewOrderProductSheet controller={controller} />);

    expect(screen.getByText('Choose an option')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Select Color Blue' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Add selected variant' })
    );

    expect(controller.handleAddProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'variant-1',
        images: ['https://example.com/parent.png'],
      })
    );
    expect(controller.fetchMoreProducts).not.toHaveBeenCalled();
  });

  it('does not duplicate the parent product title above the grouped variant selector', () => {
    const controller = makeController({
      selectableProductRows: [
        makeVariantRow('variant-1', 'Dell Latitude 7420 256GB', [
          { name: 'Ram', value: '16GB' },
          { name: 'Storage', value: '256GB SSD' },
        ]),
        makeVariantRow('variant-2', 'Dell Latitude 7420 512GB', [
          { name: 'Ram', value: '16GB' },
          { name: 'Storage', value: '512GB SSD' },
        ]),
      ],
      selectedParentProduct: {
        ...selectedParentProduct,
        name: 'Dell Latitude 7420',
      },
    });

    render(<NewOrderProductSheet controller={controller} />);

    expect(screen.getAllByText('Dell Latitude 7420')).toHaveLength(1);
  });

  it('adds missing parent ids when no selectable variant options exist', () => {
    const controller = makeController({
      selectableProductRows: [
        makeVariantRow('variant-1', 'Baci Phone Blue', null, {
          parent_product_id: null,
        }),
      ],
      selectedParentProduct,
    });

    render(<NewOrderProductSheet controller={controller} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Blue' }));

    expect(controller.handleAddProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'variant-1',
        images: ['https://example.com/parent.png'],
        parent_product_id: 'product-parent',
      })
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

  it('places the variant back control on the left and close control on the right', () => {
    const controller = makeController();

    render(<NewOrderProductSheet controller={controller} />);

    expect(
      screen.getByTestId('product-sheet-leading-accessory')
    ).toContainElement(
      screen.getByRole('button', { name: 'Back to product list' })
    );
    expect(
      screen.getByTestId('product-sheet-trailing-accessory')
    ).toContainElement(
      screen.getByRole('button', { name: 'Close product sheet' })
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Close product sheet' })
    );

    expect(controller.closeProductModal).toHaveBeenCalledTimes(1);
  });
});
