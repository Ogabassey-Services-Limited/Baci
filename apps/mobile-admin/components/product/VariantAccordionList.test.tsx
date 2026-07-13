import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import type { EditableProductVariant } from '@/lib/product-variant-form';
import { VariantAccordionList } from './VariantAccordionList';

vi.mock('./ProductVariantRow', async () => {
  const React = await import('react');
  return {
    ProductVariantRow: ({
      applyToSimilar,
      isExpanded,
      onToggleExpand,
      variantIndex,
    }: {
      applyToSimilar?: { count: number; onApply: () => void };
      isExpanded: boolean;
      onToggleExpand: () => void;
      variantIndex: number;
    }) =>
      React.createElement(
        'div',
        null,
        React.createElement(
          'button',
          {
            'aria-label': `Toggle variant ${variantIndex}`,
            onClick: onToggleExpand,
            type: 'button',
          },
          isExpanded ? 'expanded' : 'collapsed'
        ),
        isExpanded && applyToSimilar
          ? React.createElement(
              'button',
              {
                'aria-label': `Apply similar ${variantIndex}`,
                onClick: applyToSimilar.onApply,
                type: 'button',
              },
              `Apply ${applyToSimilar.count}`
            )
          : null
      ),
  };
});

vi.mock('react-native', async () => {
  const React = await import('react');
  return {
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

const colors = {} as ThemeColors;

function buildVariant(
  clientId: string,
  color: string,
  price: number
): EditableProductVariant {
  return {
    attributes: [
      { id: `${clientId}-color`, key: 'Color', value: color },
      { id: `${clientId}-storage`, key: 'Storage', value: '128GB' },
    ],
    client_id: clientId,
    condition: 'used',
    cost_price: 500,
    images: [],
    price,
    primary_image: null,
    sku: '',
    stock_quantity: 0,
  };
}

function renderList(
  overrides: Partial<{
    expandedClientId: string | null;
    variants: EditableProductVariant[];
  }> = {}
) {
  const handlers = {
    onApplyVariantPricing: vi.fn(),
    onToggleExpand: vi.fn(),
  };
  const variants = overrides.variants ?? [
    buildVariant('v1', 'Black', 1000),
    buildVariant('v2', 'Blue', 900),
  ];

  render(
    <VariantAccordionList
      colors={colors}
      currencySymbol="₦"
      expandedClientId={overrides.expandedClientId ?? null}
      onAddVariantAttribute={vi.fn()}
      onApplyVariantPricing={handlers.onApplyVariantPricing}
      onRemoveVariant={vi.fn()}
      onRemoveVariantAttribute={vi.fn()}
      onToggleExpand={handlers.onToggleExpand}
      onUpdateVariant={vi.fn()}
      onUpdateVariantAttribute={vi.fn()}
      onUpdateVariantCondition={vi.fn()}
      variants={variants}
      visibleIndexes={variants.map((_, index) => index)}
    />
  );

  return handlers;
}

describe('VariantAccordionList', () => {
  it('renders collapsed rows and forwards expand requests', () => {
    const handlers = renderList();

    expect(screen.getAllByText('collapsed')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle variant 0' }));

    expect(handlers.onToggleExpand).toHaveBeenCalledWith('v1');
  });

  it('offers apply-to-similar only for an expanded row with pricing drift', () => {
    const handlers = renderList({ expandedClientId: 'v1' });

    fireEvent.click(screen.getByRole('button', { name: 'Apply similar 0' }));

    expect(handlers.onApplyVariantPricing).toHaveBeenCalledWith([
      { cost_price: 500, indexes: [1], price: 1000 },
    ]);
  });

  it('does not offer apply-to-similar when similar variants already match', () => {
    renderList({
      expandedClientId: 'v1',
      variants: [
        buildVariant('v1', 'Black', 1000),
        buildVariant('v2', 'Blue', 1000),
      ],
    });

    expect(
      screen.queryByRole('button', { name: 'Apply similar 0' })
    ).not.toBeInTheDocument();
  });
});
