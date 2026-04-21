import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import { ProductPricingCard } from './ProductPricingCard';

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

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

describe('ProductPricingCard', () => {
  const colors = {
    border: '#e2e8f0',
    card: '#ffffff',
    error: '#dc2626',
    inputBg: '#f8fafc',
    success: '#16a34a',
    text: '#0f172a',
    textSecondary: '#64748b',
  } as unknown as ThemeColors;

  it('renders the profit summary and reports input changes', () => {
    const onCostPriceChange = vi.fn();
    const onPriceChange = vi.fn();

    render(
      <ProductPricingCard
        colors={colors}
        costPrice={400}
        currencySymbol="₦"
        onCostPriceChange={onCostPriceChange}
        onPriceChange={onPriceChange}
        price={1000}
      />
    );

    expect(screen.getByText('₦600 (60.0%)')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Selling price'), {
      target: { value: '1500' },
    });
    fireEvent.change(screen.getByLabelText('Cost price'), {
      target: { value: '700' },
    });

    expect(onPriceChange).toHaveBeenCalledWith(1500);
    expect(onCostPriceChange).toHaveBeenCalledWith(700);
  });

  it('shows the empty profit copy when cost price is not set', () => {
    render(
      <ProductPricingCard
        colors={colors}
        costPrice={0}
        currencySymbol="₦"
        onCostPriceChange={vi.fn()}
        onPriceChange={vi.fn()}
        price={1000}
      />
    );

    expect(
      screen.getByText('Enter cost price to calculate margin')
    ).toBeInTheDocument();
  });
});
