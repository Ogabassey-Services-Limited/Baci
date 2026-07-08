import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import type { EditableProductVariant } from '@/lib/product-variant-form';
import { ProductVariantRow } from './ProductVariantRow';

vi.mock('@/components/product/VariantEditorFields', async () => {
  const React = await import('react');
  return {
    VariantEditorFields: () =>
      React.createElement('span', null, 'variant-editor-body'),
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
  error: '#dc2626',
  inputBg: '#f8fafc',
  primary: '#2563eb',
  text: '#0f172a',
  textMuted: '#94a3b8',
  textSecondary: '#64748b',
} as unknown as ThemeColors;

const variant: EditableProductVariant = {
  attributes: [{ id: 'attribute-1', key: 'Storage', value: '256GB' }],
  client_id: 'variant-1',
  condition: 'new',
  cost_price: 500,
  images: [],
  price: 1000,
  primary_image: null,
  sku: 'SKU-1',
  stock_quantity: 2,
};

function renderRow(overrides: Partial<{ isExpanded: boolean }> = {}) {
  const onToggleExpand = vi.fn();
  render(
    <ProductVariantRow
      colors={colors}
      currencySymbol="₦"
      isExpanded={overrides.isExpanded ?? false}
      onAddAttribute={vi.fn()}
      onRemove={vi.fn()}
      onRemoveAttribute={vi.fn()}
      onToggleExpand={onToggleExpand}
      onUpdate={vi.fn()}
      onUpdateAttribute={vi.fn()}
      onUpdateCondition={vi.fn()}
      variant={variant}
      variantIndex={0}
    />
  );
  return { onToggleExpand };
}

describe('ProductVariantRow', () => {
  it('shows a scannable summary and hides the editor while collapsed', () => {
    renderRow({ isExpanded: false });

    expect(screen.getByText('New • 256GB')).toBeInTheDocument();
    expect(screen.getByText('₦1,000 • 2 in stock')).toBeInTheDocument();
    expect(screen.queryByText('variant-editor-body')).not.toBeInTheDocument();
  });

  it('requests expansion when the summary row is pressed', () => {
    const { onToggleExpand } = renderRow({ isExpanded: false });

    fireEvent.click(screen.getByRole('button'));

    expect(onToggleExpand).toHaveBeenCalledTimes(1);
  });

  it('renders the editor body when expanded', () => {
    renderRow({ isExpanded: true });

    expect(screen.getByText('variant-editor-body')).toBeInTheDocument();
  });
});
