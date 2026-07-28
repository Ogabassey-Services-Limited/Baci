import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MerchantSetupProgress } from './MerchantSetupProgress';

vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({
    accessibilityLabel,
    accessibilityValue,
    children,
  }: {
    accessibilityLabel?: string;
    accessibilityValue?: { max: number; min: number; now: number };
    children?: ReactNode;
  }) => (
    <div
      aria-label={accessibilityLabel}
      aria-valuemax={accessibilityValue?.max}
      aria-valuemin={accessibilityValue?.min}
      aria-valuenow={accessibilityValue?.now}
      role="progressbar"
    >
      {children}
    </div>
  ),
}));
vi.mock('@react-native-vector-icons/ionicons', () => ({ default: () => null }));
vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      border: '#ddd',
      card: '#fff',
      primary: '#2563eb',
      primaryLight: '#dbeafe',
      text: '#111',
      textOnPrimary: '#fff',
      textSecondary: '#555',
    },
  }),
}));

describe('MerchantSetupProgress', () => {
  it('communicates the owner-details step and both stage labels', () => {
    render(<MerchantSetupProgress step={1} />);

    const progress = screen.getByRole('progressbar', {
      name: 'Setup progress: step 1 of 2',
    });
    expect(progress).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByText('About you')).toBeInTheDocument();
    expect(screen.getByText('Your business')).toBeInTheDocument();
  });

  it('communicates the final business-details step', () => {
    render(<MerchantSetupProgress step={2} />);

    expect(
      screen.getByRole('progressbar', {
        name: 'Setup progress: step 2 of 2',
      })
    ).toHaveAttribute('aria-valuenow', '2');
  });
});
