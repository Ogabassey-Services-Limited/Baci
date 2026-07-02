import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ChangeEvent, ComponentProps, ReactNode } from 'react';
import { Text } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { NewOrderProductSheet } from './NewOrderProductSheet';
import type { SelectableOrderProduct } from './new-order.types';

const routerState = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock('expo-router', () => ({
  router: {
    push: routerState.push,
  },
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,

  default: () => null,
  __esModule: true,
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 8, right: 0, bottom: 12, left: 0 }),
}));

vi.mock('@/components/orders/NewOrderProductPickerSheetFrame', () => ({
  NewOrderProductPickerSheetFrame: ({
    children,
    closeLabel,
    footer,
    footerBottomInset,
    colors,
    onClose,
    title,
    trailingAccessory,
    visible,
  }: {
    children?: ReactNode;
    closeLabel: string;
    colors: { background: string };
    footer?: ReactNode;
    footerBottomInset?: number;
    onClose: () => void;
    title: string;
    trailingAccessory?: ReactNode;
    visible: boolean;
  }) =>
    visible ? (
      <section
        aria-label="product-picker-gorhom-frame"
        data-background={colors.background}
        data-footer-bottom-inset={footerBottomInset}
      >
        <button aria-label={closeLabel} onClick={onClose} type="button" />
        <h1>{title}</h1>
        {trailingAccessory}
        <div data-testid="product-sheet-body">{children}</div>
        {footer ? <div data-testid="product-sheet-footer">{footer}</div> : null}
      </section>
    ) : null,
}));

vi.mock('@gorhom/bottom-sheet', async () => {
  const React = await import('react');

  return {
    BottomSheetFlatList: ({
      contentContainerStyle,
      ListEmptyComponent,
      ListFooterComponent,
      data,
      onEndReached,
      renderItem,
    }: {
      contentContainerStyle?: { paddingBottom?: number };
      ListEmptyComponent?: ReactNode;
      ListFooterComponent?: ReactNode;
      data: unknown[];
      onEndReached?: () => void;
      renderItem: (item: { item: unknown }) => ReactNode;
    }) => (
      <div
        data-padding-bottom={contentContainerStyle?.paddingBottom}
        data-testid="product-picker-bottom-sheet-list"
      >
        {data.length === 0
          ? ListEmptyComponent
          : data.map((item, index) => (
              <div key={String(index)}>{renderItem({ item })}</div>
            ))}
        {ListFooterComponent}
        <button
          aria-label="Reach list end"
          onClick={() => onEndReached?.()}
          type="button"
        >
          Reach list end
        </button>
      </div>
    ),
    BottomSheetScrollView: ({
      children,
      testID,
    }: {
      children?: ReactNode;
      testID?: string;
    }) => <div data-testid={testID}>{children}</div>,
    BottomSheetTextInput: React.forwardRef<
      HTMLInputElement,
      {
        accessibilityLabel?: string;
        autoFocus?: boolean;
        onChangeText?: (value: string) => void;
        placeholder?: string;
        value?: string;
      }
    >(
      (
        { accessibilityLabel, autoFocus, onChangeText, placeholder, value },
        ref
      ) => (
        <input
          aria-label={accessibilityLabel ?? placeholder}
          data-autofocus={String(Boolean(autoFocus))}
          data-gorhom-input="true"
          onChange={(event: ChangeEvent<HTMLInputElement>) =>
            onChangeText?.(event.target.value)
          }
          ref={ref}
          value={value ?? ''}
        />
      )
    ),
  };
});

vi.mock('./NewOrderProductSheetEmptyState', () => ({
  NewOrderProductSheetEmptyState: () => (
    <div>
      <Text>product-empty-state</Text>
    </div>
  ),
}));

vi.mock('react-native', () => {
  return {
    useColorScheme: () => 'light',
    StatusBar: () => null,
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
    KeyboardAvoidingView: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    ActivityIndicator: () => <div role="progressbar">loading</div>,
    FlatList: ({
      contentContainerStyle,
      ListEmptyComponent,
      ListFooterComponent,
      data,
      onEndReached,
      renderItem,
    }: {
      contentContainerStyle?: { paddingBottom?: number };
      ListEmptyComponent?: ReactNode;
      ListFooterComponent?: ReactNode;
      data: unknown[];
      onEndReached?: () => void;
      renderItem: (item: { item: unknown }) => ReactNode;
    }) => (
      <div
        data-padding-bottom={contentContainerStyle?.paddingBottom}
        data-testid="product-picker-list"
      >
        {data.length === 0
          ? ListEmptyComponent
          : data.map((item, index) => (
              <div key={String(index)}>{renderItem({ item })}</div>
            ))}
        {ListFooterComponent}
        <button
          aria-label="Reach list end"
          onClick={() => onEndReached?.()}
          type="button"
        >
          Reach list end
        </button>
      </div>
    ),
    Pressable: ({
      accessibilityLabel,
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      children?: ReactNode;
      onPress?: () => void;
    }) => (
      <button
        aria-label={accessibilityLabel}
        onClick={() => onPress?.()}
        type="button"
      >
        {children}
      </button>
    ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    TextInput: ({
      accessibilityLabel,
      autoFocus,
      onChangeText,
      placeholder,
      value,
    }: {
      accessibilityLabel?: string;
      autoFocus?: boolean;
      onChangeText?: (value: string) => void;
      placeholder?: string;
      value?: string;
    }) => (
      <input
        aria-label={accessibilityLabel ?? placeholder}
        data-autofocus={String(Boolean(autoFocus))}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value)
        }
        value={value ?? ''}
      />
    ),
    View: ({
      children,
      style,
      testID,
    }: {
      children?: ReactNode;
      style?: Record<string, unknown>;
      testID?: string;
    }) => (
      <div
        data-padding-bottom={String(style?.paddingBottom ?? '')}
        data-padding-horizontal={String(style?.paddingHorizontal ?? '')}
        data-padding-top={String(style?.paddingTop ?? '')}
        data-testid={testID}
      >
        {children}
      </div>
    ),
  };
});

type ProductSheetController = ComponentProps<
  typeof NewOrderProductSheet
>['controller'];

const productRow: SelectableOrderProduct = {
  condition: 'brand_new',
  has_variants: false,
  id: 'product-1',
  images: ['https://example.com/phone.png'],
  name: 'Baci Phone',
  parent_product_id: null,
  price: 2500,
  sku: 'SKU-1',
  variant_attributes: [],
};

function makeController(
  overrides: Partial<ProductSheetController> = {}
): ProductSheetController {
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
      textSecondary: '#64748b',
    },
    fetchMoreProducts: vi.fn(),
    formatPrice: (amount: number) => `₦${amount}`,
    handleAddProduct: vi.fn(),
    handleSelectProduct: vi.fn(),
    hasMoreProducts: true,
    isFetchingMoreProducts: false,
    isLoadingSelectedParentProduct: false,
    isPickingVariant: false,
    isProductsLoading: false,
    productSearch: '',
    productsError: null,
    refetchProducts: vi.fn(async () => undefined),
    refetchSelectedParentProduct: vi.fn(async () => undefined),
    resetProductPickerState: vi.fn(),
    selectableProductRows: [productRow],
    selectedParentProduct: null,
    selectedParentProductError: null,
    setProductSearch: vi.fn(),
    showProductModal: true,
    ...overrides,
  } as unknown as ProductSheetController;
}

describe('NewOrderProductSheet', () => {
  it('renders product search mode and forwards search, selection, and pagination actions', () => {
    const controller = makeController();

    render(<NewOrderProductSheet controller={controller} />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Search products' }), {
      target: { value: 'Laptop' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Select Baci Phone' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reach list end' }));

    expect(controller.setProductSearch).toHaveBeenCalledWith('Laptop');
    expect(controller.handleSelectProduct).toHaveBeenCalledWith(
      controller.selectableProductRows[0]
    );
    expect(controller.fetchMoreProducts).toHaveBeenCalledTimes(1);
  });

  it('anchors product search in the Gorhom sheet footer so keyboard avoidance can move it', () => {
    const controller = makeController();

    render(<NewOrderProductSheet controller={controller} />);

    const searchInput = screen.getByRole('textbox', {
      name: 'Search products',
    });

    expect(
      screen.getByLabelText('product-picker-gorhom-frame')
    ).toHaveAttribute('data-background', controller.colors.background);
    expect(
      screen.getByLabelText('product-picker-gorhom-frame')
    ).toHaveAttribute('data-footer-bottom-inset', '18');
    expect(screen.getByTestId('product-sheet-footer')).toContainElement(
      searchInput
    );
    expect(searchInput).toHaveAttribute('data-autofocus', 'true');
    expect(searchInput).toHaveAttribute('data-gorhom-input', 'true');
    expect(
      screen.getByTestId('product-picker-bottom-sheet-list')
    ).toHaveAttribute('data-padding-bottom', '128');
  });

  it('closes the sheet and navigates to the product creation screen', () => {
    const controller = makeController();

    render(<NewOrderProductSheet controller={controller} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create new product' }));

    expect(controller.closeProductModal).toHaveBeenCalledTimes(1);
    expect(routerState.push).toHaveBeenCalledWith('/product/new');
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
