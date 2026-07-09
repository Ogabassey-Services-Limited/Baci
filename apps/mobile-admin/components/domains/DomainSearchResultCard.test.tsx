import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DomainSearchResultCard } from './DomainSearchResultCard';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: ({ name }: { name?: string }) => (
    <span aria-hidden="true" data-icon={name} />
  ),

  default: ({ name }: { name?: string }) => (
    <span aria-hidden="true" data-icon={name} />
  ),
  __esModule: true,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      border: '#334155',
      card: '#111827',
      primary: '#3b82f6',
      success: '#16a34a',
      text: '#f8fafc',
      textOnPrimary: '#ffffff',
      textSecondary: '#94a3b8',
    },
    shadows: {
      sm: {},
    },
  }),
}));

vi.mock('react-native', () => ({
  StatusBar: () => null,
  ActivityIndicator: () => <output aria-label="loading" />,
  Pressable: ({
    accessibilityLabel,
    children,
    disabled,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    disabled?: boolean;
    onPress?: () => void;
  }) => (
    <button
      aria-label={accessibilityLabel}
      disabled={disabled}
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
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe('DomainSearchResultCard', () => {
  it('renders an available result and calls onBuy', () => {
    const onBuy = vi.fn();

    render(
      <DomainSearchResultCard
        domain={{
          available: true,
          currency: 'NGN',
          domain: 'baci.com',
          popular: true,
          price: 25000,
        }}
        isPurchasing={false}
        onBuy={onBuy}
      />
    );

    expect(screen.getByText('baci.com')).toBeInTheDocument();
    expect(screen.getByText('POPULAR')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Buy baci.com' }));

    expect(onBuy).toHaveBeenCalledTimes(1);
  });

  it('hides the buy button for unavailable results', () => {
    render(
      <DomainSearchResultCard
        domain={{
          available: false,
          currency: 'NGN',
          domain: 'baci.com',
          price: 25000,
        }}
        isPurchasing={false}
        onBuy={vi.fn()}
      />
    );

    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Buy baci.com' })
    ).not.toBeInTheDocument();
  });

  it('always formats the price in NGN, ignoring the domain result currency field', () => {
    // Domain prices are platform costs billed in NGN regardless of what the
    // API reports for a given result — mirrors the web dashboard's domain
    // search panel, which hardcodes NGN rather than trusting a per-result
    // currency.
    render(
      <DomainSearchResultCard
        domain={{
          available: true,
          currency: 'USD',
          domain: 'baci.com',
          price: 25000,
        }}
        isPurchasing={false}
        onBuy={vi.fn()}
      />
    );

    expect(screen.getByText('₦25,000')).toBeInTheDocument();
  });

  it('labels the price as billed in NGN', () => {
    render(
      <DomainSearchResultCard
        domain={{
          available: true,
          currency: 'NGN',
          domain: 'baci.com',
          price: 25000,
        }}
        isPurchasing={false}
        onBuy={vi.fn()}
      />
    );

    expect(screen.getByText('₦25,000')).toBeInTheDocument();
    expect(screen.getByText('Billed in NGN')).toBeInTheDocument();
  });

  it('shows the loading state and disables the buy button while purchasing', () => {
    render(
      <DomainSearchResultCard
        domain={{
          available: true,
          currency: 'NGN',
          domain: 'baci.com',
          price: 25000,
        }}
        isPurchasing={true}
        onBuy={vi.fn()}
      />
    );

    expect(screen.getByLabelText('loading')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buy baci.com' })).toBeDisabled();
  });
});
