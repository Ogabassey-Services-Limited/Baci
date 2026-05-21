import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import type { PurchasesPackage } from 'react-native-purchases';
import PaywallPackageList from './PaywallPackageList';

vi.mock('react-native', () => ({
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
    style,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    onPress?: () => void;
    style?: unknown;
  }) => {
    const resolvedStyle = Array.isArray(style) ? style : [style];
    return (
      <button
        type="button"
        aria-label={accessibilityLabel}
        data-has-style={Boolean(resolvedStyle.length)}
        onClick={() => onPress?.()}
      >
        {children}
      </button>
    );
  },
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

const colors = {
  border: '#e2e8f0',
  card: '#ffffff',
  success: '#16a34a',
  text: '#0f172a',
  textSecondary: '#334155',
  primary: '#3b82f6',
} as ThemeColors;

const monthlyPackage = {
  identifier: 'monthly',
  packageType: 'MONTHLY',
  product: {
    price: 10,
    priceString: '$10.00',
  },
} as PurchasesPackage;

const annualPackage = {
  identifier: 'annual',
  packageType: 'ANNUAL',
  product: {
    price: 100,
    priceString: '$100.00',
  },
} as PurchasesPackage;

describe('PaywallPackageList', () => {
  it('shows computed annual savings and selects tapped package', () => {
    const setSelectedPackage = vi.fn();

    render(
      <PaywallPackageList
        colors={colors}
        packages={[monthlyPackage, annualPackage] as PurchasesPackage[]}
        selectedPackage={monthlyPackage as PurchasesPackage}
        setSelectedPackage={setSelectedPackage}
      />
    );

    expect(screen.getByText('SAVE 17%')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Yearly subscription/i }));
    expect(setSelectedPackage).toHaveBeenCalledWith(annualPackage);
  });
});
