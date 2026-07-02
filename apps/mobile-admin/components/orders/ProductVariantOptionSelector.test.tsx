import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AdminProductVariant } from '@/lib/product-picker-variant-rows';
import { ProductVariantOptionSelector } from './ProductVariantOptionSelector';

vi.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetScrollView: ({
    children,
    contentContainerStyle,
    testID,
  }: {
    children?: ReactNode;
    contentContainerStyle?: unknown;
    testID?: string;
  }) => (
    <div
      data-has-content-container-style={Boolean(contentContainerStyle)}
      data-testid={testID}
    >
      {children}
    </div>
  ),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Pressable: ({
      accessibilityLabel,
      accessibilityState,
      children,
      disabled,
      onPress,
      style,
    }: {
      accessibilityLabel?: string;
      accessibilityState?: { disabled?: boolean; selected?: boolean };
      children?: ReactNode;
      disabled?: boolean;
      onPress?: () => void;
      style?: unknown;
    }) =>
      React.createElement(
        'button',
        {
          'aria-disabled': disabled || accessibilityState?.disabled,
          'aria-label': accessibilityLabel,
          'aria-pressed': accessibilityState?.selected,
          'data-style-kind': typeof style,
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
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children, testID }: { children?: ReactNode; testID?: string }) =>
      React.createElement('div', { 'data-testid': testID }, children),
  };
});

const colors = {
  backgroundLight: '#f8fafc',
  border: '#e2e8f0',
  card: '#ffffff',
  error: '#dc2626',
  primary: '#2563eb',
  text: '#0f172a',
  textMuted: '#94a3b8',
  textOnPrimary: '#ffffff',
  textSecondary: '#64748b',
};

function variant(
  id: string,
  attributes: Record<string, string>,
  overrides: Partial<AdminProductVariant> = {}
): AdminProductVariant {
  return {
    condition: 'new',
    cost_price: null,
    has_variants: false,
    id,
    images: [],
    name: `Samsung S26 ${id}`,
    parent_product_id: 'product-1',
    price: 1000,
    primary_image: null,
    sku: id.toUpperCase(),
    source: 'structured',
    stock_quantity: 1,
    variant_attributes: attributes,
    ...overrides,
  };
}

function parentProduct(
  overrides: Partial<
    Parameters<typeof ProductVariantOptionSelector>[0]['parentProduct']
  > = {}
): Parameters<typeof ProductVariantOptionSelector>[0]['parentProduct'] {
  return {
    condition: 'new',
    has_variants: true,
    id: 'product-1',
    images: [],
    name: 'Samsung Galaxy S26',
    parent_product_id: null,
    price: 1000,
    sku: null,
    variant_attributes: [],
    ...overrides,
  };
}

function selectorElement({
  onAddProduct = vi.fn(),
  parent = parentProduct(),
  variants,
}: {
  onAddProduct?: (product: AdminProductVariant) => void;
  parent?: Parameters<typeof ProductVariantOptionSelector>[0]['parentProduct'];
  variants: AdminProductVariant[];
}) {
  return (
    <ProductVariantOptionSelector
      colors={colors}
      formatPrice={(amount) => `₦${amount}`}
      onAddProduct={onAddProduct}
      parentProduct={parent}
      variants={variants}
    />
  );
}

function renderSelector(props: Parameters<typeof selectorElement>[0]) {
  return render(selectorElement(props));
}

describe('ProductVariantOptionSelector', () => {
  it('uses the Gorhom scroll view for long option groups inside the bottom sheet', () => {
    renderSelector({
      variants: [variant('variant-1', { storage: '256GB SSD' })],
    });

    expect(screen.getByTestId('variant-option-scroll-view')).toHaveAttribute(
      'data-has-content-container-style',
      'true'
    );
  });

  it('lets the user tap options until a valid variant can be added', () => {
    const onAddProduct = vi.fn();
    const variants = [
      variant('variant-1', {
        color: 'Black',
        ram: '12GB',
        storage: '256GB',
      }),
      variant('variant-2', {
        color: 'Blue',
        ram: '12GB',
        storage: '512GB',
      }),
    ];

    renderSelector({
      onAddProduct,
      parent: parentProduct({
        images: ['https://example.test/parent.jpg'],
      }),
      variants,
    });

    expect(
      screen.getByRole('button', { name: 'Add selected variant' })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Select Color Blue' })
    ).not.toHaveAttribute('data-style-kind', 'function');
    expect(
      screen.getByRole('button', { name: 'Add selected variant' })
    ).not.toHaveAttribute('data-style-kind', 'function');
    expect(screen.getByTestId('variant-fixed-options')).toHaveTextContent(
      'Ram'
    );
    expect(screen.getByTestId('variant-fixed-options')).toHaveTextContent(
      '12GB'
    );
    expect(
      screen.queryByRole('button', { name: 'Select Ram 12GB' })
    ).not.toBeInTheDocument();
    expect(
      screen
        .getByTestId('variant-fixed-options')
        .compareDocumentPosition(
          screen.getByTestId('variant-option-scroll-view')
        )
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    fireEvent.click(screen.getByRole('button', { name: 'Select Color Blue' }));

    expect(
      screen.queryByRole('button', { name: 'Select Storage 256GB' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Select Storage 512GB' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Add selected variant' })
    ).toBeDisabled();

    expect(onAddProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'variant-2',
        images: ['https://example.test/parent.jpg'],
      })
    );
    expect(onAddProduct).toHaveBeenCalledTimes(1);
  });

  it('prevents duplicate manual adds for a fully resolved fixed variant', () => {
    const onAddProduct = vi.fn();

    renderSelector({
      onAddProduct,
      variants: [
        variant('variant-fixed', {
          condition: 'new',
          ram: '12GB',
          storage: '256GB',
        }),
      ],
    });

    const addButton = screen.getByRole('button', {
      name: 'Add selected variant',
    });

    expect(addButton).not.toBeDisabled();

    fireEvent.click(addButton);
    fireEvent.click(addButton);

    expect(onAddProduct).toHaveBeenCalledTimes(1);
    expect(addButton).toBeDisabled();
  });

  it('adds the variant immediately when the final selectable option is chosen', () => {
    const onAddProduct = vi.fn();

    renderSelector({
      onAddProduct,
      parent: parentProduct({
        images: ['https://example.test/parent.jpg'],
        name: 'HP EliteBook x360 1040 G10',
      }),
      variants: [
        variant('variant-i7', {
          color: 'Natural Silver',
          condition: 'used',
          display_type: 'WUXGA Touchscreen',
          os: 'Windows 11 Pro',
          processor: 'Intel Core i7-1365U',
          ram: '16GB LPDDR5',
          screen_size: '14 inch',
          storage: '512GB SSD',
        }),
        variant('variant-i5', {
          color: 'Natural Silver',
          condition: 'used',
          display_type: 'WUXGA Touchscreen',
          os: 'Windows 11 Pro',
          processor: 'Intel Core i5-1335U',
          ram: '16GB LPDDR5',
          screen_size: '14 inch',
          storage: '512GB SSD',
        }),
      ],
    });

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Select Processor Intel Core i7-1365U',
      })
    );

    expect(onAddProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'variant-i7',
        images: ['https://example.test/parent.jpg'],
      })
    );
  });

  it('uses an empty image array when selected and parent products have no images', () => {
    const onAddProduct = vi.fn();

    renderSelector({
      onAddProduct,
      parent: parentProduct({
        images: undefined as unknown as string[],
      }),
      variants: [
        variant('variant-1', {
          color: 'Black',
          storage: '256GB',
        }),
      ],
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Add selected variant' })
    );

    expect(onAddProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'variant-1',
        images: [],
      })
    );
  });

  it('lets users clear a selected option after refreshed variants make it unavailable', () => {
    const selectedParentProduct = parentProduct();
    const { rerender } = renderSelector({
      parent: selectedParentProduct,
      variants: [
        variant('variant-1', { color: 'Blue', storage: '256GB' }),
        variant('variant-2', { color: 'Blue', storage: '512GB' }),
      ],
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Select Storage 256GB' })
    );
    rerender(
      selectorElement({
        parent: selectedParentProduct,
        variants: [
          variant('variant-2', { color: 'Blue', storage: '512GB' }),
          variant('variant-3', { color: 'Black', storage: '256GB' }),
        ],
      })
    );

    const staleStorage = screen.getByRole('button', {
      name: 'Select Storage 256GB',
    });

    expect(staleStorage).not.toBeDisabled();
    fireEvent.click(staleStorage);
    expect(
      screen.getByRole('button', { name: 'Select Storage 256GB' })
    ).toHaveAttribute('aria-pressed', 'false');
  });
});
