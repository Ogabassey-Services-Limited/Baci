import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import type { EditableProductVariant } from '@/lib/product-variant-form';
import { ProductVariantsCard } from './ProductVariantsCard';

vi.mock('./PriceInput', () => ({
  PriceInput: ({
    accessibilityLabel,
    onChange,
    value,
  }: {
    accessibilityLabel: string;
    onChange: (value: number) => void;
    value: number;
  }) => (
    <input
      aria-label={accessibilityLabel}
      onChange={(event) => onChange(Number(event.target.value))}
      value={value}
    />
  ),
}));

vi.mock('./ProductVariantRow', async () => {
  const React = await import('react');
  return {
    ProductVariantRow: ({
      applyToSimilar,
      isExpanded,
      onToggleExpand,
      onUpdate,
      variantIndex,
    }: {
      applyToSimilar?: { count: number; onApply: () => void };
      isExpanded: boolean;
      onToggleExpand: () => void;
      onUpdate: (updates: { sku: string }) => void;
      variantIndex: number;
    }) =>
      React.createElement(
        'div',
        null,
        React.createElement(
          'button',
          {
            'aria-label': `Update variant row ${variantIndex + 1}`,
            onClick: () => onUpdate({ sku: `SKU-${variantIndex + 1}` }),
            type: 'button',
          },
          `row ${variantIndex + 1}`
        ),
        React.createElement('button', {
          'aria-label': `Toggle variant row ${variantIndex + 1}`,
          onClick: () => onToggleExpand(),
          type: 'button',
        }),
        isExpanded && applyToSimilar
          ? React.createElement(
              'button',
              {
                'aria-label': `Apply similar for row ${variantIndex + 1}`,
                onClick: () => applyToSimilar.onApply(),
                type: 'button',
              },
              `similar ${applyToSimilar.count}`
            )
          : null
      ),
  };
});

vi.mock('./VariantBuilderSheet', async () => {
  const React = await import('react');
  return {
    VariantBuilderSheet: () =>
      React.createElement('span', null, 'variant-builder-sheet'),
  };
});

vi.mock('./VariantGroupPricingSheet', async () => {
  const React = await import('react');
  return {
    VariantGroupPricingSheet: () =>
      React.createElement('span', null, 'group-pricing-sheet'),
  };
});

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
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
      hairlineWidth: 1,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
  __esModule: true,
}));

const colors = {
  border: '#e2e8f0',
  card: '#ffffff',
  inputBg: '#f8fafc',
  primary: '#2563eb',
  text: '#0f172a',
  textMuted: '#94a3b8',
  textOnPrimary: '#ffffff',
  textSecondary: '#64748b',
} as unknown as ThemeColors;

const variants: EditableProductVariant[] = [
  {
    attributes: [],
    client_id: 'variant-1',
    condition: 'new',
    cost_price: 500,
    images: [],
    price: 1000,
    primary_image: null,
    sku: 'SKU-1',
    stock_quantity: 2,
  },
];

function renderCard(
  overrides: Partial<{
    variants: EditableProductVariant[];
    hasVariantConditionAxis: boolean;
  }> = {}
) {
  const handlers = {
    onAddVariant: vi.fn(() => 'variant-2'),
    onApplyVariantPricing: vi.fn(),
    onDefaultCostPriceChange: vi.fn(),
    onDefaultPriceChange: vi.fn(),
    onGenerateVariants: vi.fn(),
    onUpdateVariant: vi.fn(),
  };

  const makeCard = (
    nextOverrides: Partial<{
      variants: EditableProductVariant[];
      hasVariantConditionAxis: boolean;
    }> = overrides
  ) => (
    <ProductVariantsCard
      colors={colors}
      currencySymbol="₦"
      hasVariantConditionAxis={nextOverrides.hasVariantConditionAxis ?? true}
      onAddVariant={handlers.onAddVariant}
      onAddVariantAttribute={vi.fn()}
      onApplyVariantPricing={handlers.onApplyVariantPricing}
      onDefaultCostPriceChange={handlers.onDefaultCostPriceChange}
      onDefaultPriceChange={handlers.onDefaultPriceChange}
      onGenerateVariants={handlers.onGenerateVariants}
      onRemoveVariant={vi.fn()}
      onRemoveVariantAttribute={vi.fn()}
      onUpdateVariant={handlers.onUpdateVariant}
      onUpdateVariantAttribute={vi.fn()}
      onUpdateVariantCondition={vi.fn()}
      value={{ cost_price: 300, price: 900 }}
      variants={nextOverrides.variants ?? variants}
    />
  );
  const result = render(makeCard());

  return {
    ...handlers,
    rerenderCard: (nextOverrides: Parameters<typeof makeCard>[0]) =>
      result.rerender(makeCard(nextOverrides)),
  };
}

describe('ProductVariantsCard', () => {
  it('wires default price edits and per-row updates through the variant index', () => {
    const handlers = renderCard();

    fireEvent.click(
      screen.getByRole('button', { name: 'Add product variant' })
    );
    fireEvent.change(screen.getByLabelText('Default selling price'), {
      target: { value: '1200' },
    });
    fireEvent.change(screen.getByLabelText('Default cost price'), {
      target: { value: '600' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Update variant row 1' })
    );

    expect(handlers.onAddVariant).toHaveBeenCalledTimes(1);
    expect(handlers.onDefaultPriceChange).toHaveBeenCalledWith(1200);
    expect(handlers.onDefaultCostPriceChange).toHaveBeenCalledWith(600);
    expect(handlers.onUpdateVariant).toHaveBeenCalledWith(0, { sku: 'SKU-1' });
  });

  it('keeps the how-it-works explanation collapsed until requested', () => {
    renderCard();

    expect(
      screen.queryByText(/Condition is now part of the variant identity/i)
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'How variants work' }));

    expect(
      screen.getByText(/Condition is now part of the variant identity/i)
    ).toBeInTheDocument();
  });

  it('opens the variant builder sheet on demand', () => {
    renderCard();

    expect(screen.queryByText('variant-builder-sheet')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Build variants from options' })
    );

    expect(screen.getByText('variant-builder-sheet')).toBeInTheDocument();
  });

  it('shows an empty state with a build entry point when there are no variants', () => {
    renderCard({ variants: [] });

    expect(screen.getByText('No variants yet')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Build variants from options' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Update variant row 1' })
    ).not.toBeInTheDocument();
  });

  it('hides the bulk pricing button for small variant sets', () => {
    renderCard();

    expect(
      screen.queryByRole('button', { name: 'Set prices in bulk' })
    ).not.toBeInTheDocument();
  });

  it('opens the group pricing sheet from the bulk button', () => {
    renderCard({ variants: makeStorageVariants(4) });

    expect(screen.queryByText('group-pricing-sheet')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Set prices in bulk' }));

    expect(screen.getByText('group-pricing-sheet')).toBeInTheDocument();
  });

  it('filters the list by attribute value while keeping real variant indexes', () => {
    renderCard({ variants: makeStorageVariants(5) });

    // 5 variants: indexes 0-2 are 64GB, 3-4 are 128GB.
    fireEvent.click(
      screen.getByRole('button', { name: 'Filter by Storage 128GB' })
    );

    expect(screen.getByText('Showing 2 of 5 variants')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Update variant row 4' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Update variant row 5' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Update variant row 1' })
    ).not.toBeInTheDocument();

    // Tapping the same chip again clears the filter.
    fireEvent.click(
      screen.getByRole('button', { name: 'Filter by Storage 128GB' })
    );
    expect(
      screen.getByRole('button', { name: 'Update variant row 1' })
    ).toBeInTheDocument();
  });

  it('ignores stale filters when variant count falls below the filter threshold', () => {
    const { rerenderCard } = renderCard({
      variants: makeStorageVariants(5),
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Filter by Storage 128GB' })
    );
    expect(screen.getByText('Showing 2 of 5 variants')).toBeInTheDocument();

    rerenderCard({ variants: makeStorageVariants(4) });

    expect(screen.queryByText(/Showing .* variants/)).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Update variant row 1' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Update variant row 4' })
    ).toBeInTheDocument();
  });

  it('offers apply-to-similar for an expanded variant whose siblings have drifted pricing', () => {
    const twins: EditableProductVariant[] = [
      {
        attributes: [
          { id: 'c1', key: 'Color', value: 'Black' },
          { id: 's1', key: 'Storage', value: '128GB' },
        ],
        client_id: 'variant-1',
        condition: 'used',
        cost_price: 500,
        images: [],
        price: 1000,
        primary_image: null,
        sku: '',
        stock_quantity: 0,
      },
      {
        attributes: [
          { id: 'c2', key: 'Color', value: 'Blue' },
          { id: 's2', key: 'Storage', value: '128GB' },
        ],
        client_id: 'variant-2',
        condition: 'used',
        cost_price: 500,
        images: [],
        price: 900,
        primary_image: null,
        sku: '',
        stock_quantity: 0,
      },
    ];
    const handlers = renderCard({ variants: twins });

    fireEvent.click(
      screen.getByRole('button', { name: 'Toggle variant row 1' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Apply similar for row 1' })
    );

    expect(handlers.onApplyVariantPricing).toHaveBeenCalledWith([
      { cost_price: 500, indexes: [1], price: 1000 },
    ]);
  });
});

function makeStorageVariants(count: number): EditableProductVariant[] {
  return Array.from({ length: count }, (_, index) => ({
    attributes: [
      {
        id: `attr-${index}`,
        key: 'Storage',
        value: index < 3 ? '64GB' : '128GB',
      },
    ],
    client_id: `variant-${index + 1}`,
    condition: 'new' as const,
    cost_price: 500,
    images: [],
    price: 1000,
    primary_image: null,
    sku: `SKU-${index + 1}`,
    stock_quantity: 0,
  }));
}
