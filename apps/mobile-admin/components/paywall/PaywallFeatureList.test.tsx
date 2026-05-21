import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import PaywallFeatureList from './PaywallFeatureList';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => <span>icon</span>,
}));

vi.mock('react-native', () => ({
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

const colors = {
  primary: '#3B82F6',
  text: '#0F172A',
  textSecondary: '#64748B',
} as ThemeColors;

describe('PaywallFeatureList', () => {
  it('renders all Pro feature copy rows', () => {
    render(<PaywallFeatureList colors={colors} />);

    expect(screen.getByText('Unlimited Storefronts')).toBeInTheDocument();
    expect(
      screen.getByText('Predict trends and customer behavior')
    ).toBeInTheDocument();
    expect(screen.getByText('Priority Support')).toBeInTheDocument();
  });
});
