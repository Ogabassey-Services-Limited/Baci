import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { TransactionReconciliationItemCard } from './TransactionReconciliationItemCard';

vi.mock('react-native', async () => {
  const React = await import('react');

  type NativeProps = {
    accessibilityLabel?: string;
    accessibilityRole?: string;
    children?: React.ReactNode;
    disabled?: boolean;
    onPress?: () => void;
  };

  return {
	    Pressable: ({
	      accessibilityLabel,
	      accessibilityRole,
	      children,
	      disabled,
      onPress,
    }: NativeProps) =>
      React.createElement(
        'button',
	        {
	          'aria-label': accessibilityLabel,
	          disabled,
	          onClick: () => {
	            if (!disabled) {
	              onPress?.();
	            }
	          },
	          role: accessibilityRole,
	          type: 'button',
	        },
        children
      ),
    StyleSheet: { create: <T,>(styles: T) => styles },
    Text: ({ children }: NativeProps) =>
      React.createElement('span', null, children),
    View: ({ children }: NativeProps) =>
      React.createElement('div', null, children),
  };
});

describe('TransactionReconciliationItemCard', () => {
  it('links a suggested match and keeps an item custom', () => {
    const onKeepCustom = vi.fn();
    const onLink = vi.fn();

    render(
      <TransactionReconciliationItemCard
        colors={LIGHT_COLORS}
        createdAt="2026-05-11T10:00:00.000Z"
        customerName="Olayinka Akerele"
        formatCurrency={(amount) => `₦${amount.toLocaleString('en-US')}`}
        isMutating={false}
        item={{
          id: 'item-1',
          name: 'iPhone 11 Pro 64GB Premium Used',
          price: 180000,
          quantity: 1,
        }}
        matches={[
          {
            confidence: 'high',
            label: 'iPhone 11 Pro 64GB Premium Used',
            price: 180000,
            productId: 'product-1',
            score: 120,
            variantId: 'variant-1',
          },
        ]}
        onKeepCustom={onKeepCustom}
        onLink={onLink}
        orderNumber="ORD-110526-74B115"
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Link iPhone 11 Pro 64GB Premium Used' })
    );
    expect(onLink).toHaveBeenCalledWith({
      itemId: 'item-1',
      productId: 'product-1',
      variantId: 'variant-1',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Keep item custom' }));
	    expect(onKeepCustom).toHaveBeenCalledWith('item-1');
	  });

	  it('pluralizes quantities greater than one', () => {
	    render(
	      <TransactionReconciliationItemCard
	        colors={LIGHT_COLORS}
	        formatCurrency={(amount) => `₦${amount.toLocaleString('en-US')}`}
	        isMutating={false}
	        item={{
	          id: 'item-1',
	          name: 'Itel Buds Neo 3',
	          price: 20000,
	          quantity: 2,
	        }}
	        matches={[]}
	        onKeepCustom={vi.fn()}
	        onLink={vi.fn()}
	      />
	    );

	    expect(screen.getByText('2 items')).toBeInTheDocument();
	  });

	  it('disables actions while mutating and prevents callbacks', () => {
	    const onKeepCustom = vi.fn();
	    const onLink = vi.fn();

	    render(
	      <TransactionReconciliationItemCard
	        colors={LIGHT_COLORS}
	        formatCurrency={(amount) => `₦${amount.toLocaleString('en-US')}`}
	        isMutating
	        item={{
	          id: 'item-1',
	          name: 'iPhone 11',
	          price: 180000,
	          quantity: 1,
	        }}
	        matches={[
	          {
	            confidence: 'high',
	            label: 'iPhone 11',
	            price: 180000,
	            productId: 'product-1',
	            score: 100,
	            variantId: null,
	          },
	        ]}
	        onKeepCustom={onKeepCustom}
	        onLink={onLink}
	      />
	    );

	    const linkButton = screen.getByRole('button', { name: 'Link iPhone 11' });
	    const keepCustomButton = screen.getByRole('button', {
	      name: 'Keep item custom',
	    });

	    expect(linkButton).toBeDisabled();
	    expect(keepCustomButton).toBeDisabled();

	    fireEvent.click(linkButton);
	    fireEvent.click(keepCustomButton);

	    expect(onLink).not.toHaveBeenCalled();
	    expect(onKeepCustom).not.toHaveBeenCalled();
	  });

	  it('shows fallback text when no close catalog match exists', () => {
	    render(
	      <TransactionReconciliationItemCard
	        colors={LIGHT_COLORS}
	        formatCurrency={(amount) => `₦${amount.toLocaleString('en-US')}`}
	        isMutating={false}
	        item={{
	          id: 'item-1',
	          name: 'Itel Buds Neo 3',
	          price: 20000,
	          quantity: 1,
	        }}
	        matches={[]}
	        onKeepCustom={vi.fn()}
	        onLink={vi.fn()}
	      />
	    );

	    expect(screen.getByText('No close catalog match found.')).toBeInTheDocument();
	    expect(screen.queryByRole('button', { name: /^Link / })).not.toBeInTheDocument();
	  });
	});
