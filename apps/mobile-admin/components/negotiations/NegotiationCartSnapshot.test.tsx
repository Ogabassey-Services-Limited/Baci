import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NegotiationCartSnapshot } from './NegotiationCartSnapshot';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
  __esModule: true,
}));

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
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

const colors = {
  border: '#334155',
  text: '#f8fafc',
  textSecondary: '#94a3b8',
};

describe('NegotiationCartSnapshot', () => {
  it('renders expanded line items with quantity-aware prices', () => {
    render(
      <NegotiationCartSnapshot
        cartSnapshot={[
          {
            product_id: 'product-1',
            name: 'Dell Latitude',
            price: 450_000,
            quantity: 2,
            variant_id: 'variant-1',
            variant_name: '16GB / 512GB',
            condition: 'used',
          },
        ]}
        colors={colors}
        expanded={true}
        negotiationId="negotiation-1"
        onToggleCart={vi.fn()}
      />
    );

    expect(screen.getByText('Dell Latitude')).toBeInTheDocument();
    expect(
      screen.getByText('16GB / 512GB · Condition: used')
    ).toBeInTheDocument();
    expect(screen.getByText(/900,000/)).toBeInTheDocument();
  });

  it('forwards toggle presses with the negotiation id', () => {
    const onToggleCart = vi.fn();

    render(
      <NegotiationCartSnapshot
        cartSnapshot={[
          {
            product_id: 'product-1',
            name: 'Dell Latitude',
            price: 450_000,
            quantity: 1,
          },
        ]}
        colors={colors}
        expanded={false}
        negotiationId="negotiation-1"
        onToggleCart={onToggleCart}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'View 1 cart item' }));

    expect(onToggleCart).toHaveBeenCalledWith('negotiation-1');
    expect(screen.queryByText('Dell Latitude')).not.toBeInTheDocument();
  });

  it('uses the plural cart item label for multiple collapsed items', () => {
    render(
      <NegotiationCartSnapshot
        cartSnapshot={[
          {
            product_id: 'product-1',
            name: 'Dell Latitude',
            price: 450_000,
            quantity: 1,
          },
          {
            product_id: 'product-2',
            name: 'Galaxy S24',
            price: 900_000,
            quantity: 1,
          },
        ]}
        colors={colors}
        expanded={false}
        negotiationId="negotiation-1"
        onToggleCart={vi.fn()}
      />
    );

    expect(
      screen.getByRole('button', { name: 'View 2 cart items' })
    ).toBeInTheDocument();
    expect(screen.getByText('View 2 items')).toBeInTheDocument();
  });

  it('renders partial metadata when only variant or condition exists', () => {
    render(
      <NegotiationCartSnapshot
        cartSnapshot={[
          {
            product_id: 'product-1',
            name: 'Dell Latitude',
            price: 450_000,
            quantity: 1,
            variant_name: '16GB / 512GB',
          },
          {
            product_id: 'product-2',
            name: 'Galaxy S24',
            price: 900_000,
            quantity: 1,
            condition: 'open_box',
          },
        ]}
        colors={colors}
        expanded={true}
        negotiationId="negotiation-1"
        onToggleCart={vi.fn()}
      />
    );

    expect(screen.getByText('16GB / 512GB')).toBeInTheDocument();
    expect(screen.getByText('Condition: open box')).toBeInTheDocument();
  });

  it('keeps option-only cart lines keyed distinctly', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      render(
        <NegotiationCartSnapshot
          cartSnapshot={[
            {
              product_id: 'product-1',
              name: 'Galaxy S24',
              price: 900_000,
              quantity: 1,
              variant_name: 'Red',
            },
            {
              product_id: 'product-1',
              name: 'Galaxy S24',
              price: 900_000,
              quantity: 1,
              variant_name: 'Blue',
            },
          ]}
          colors={colors}
          expanded={true}
          negotiationId="negotiation-1"
          onToggleCart={vi.fn()}
        />
      );

      const duplicateKeyWarnings = errorSpy.mock.calls.filter(([message]) =>
        String(message).includes('Encountered two children with the same key')
      );
      expect(duplicateKeyWarnings).toHaveLength(0);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('handles an empty snapshot without rendering line items', () => {
    render(
      <NegotiationCartSnapshot
        cartSnapshot={[]}
        colors={colors}
        expanded={true}
        negotiationId="negotiation-1"
        onToggleCart={vi.fn()}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Hide cart items' })
    ).toBeInTheDocument();
    expect(screen.queryByText(/₦/)).not.toBeInTheDocument();
  });
});
