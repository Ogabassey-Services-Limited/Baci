import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import { ProductVariantsCardHeader } from './ProductVariantsCardHeader';

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
      accessibilityRole,
      accessibilityState,
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      accessibilityState?: { expanded?: boolean };
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-expanded': accessibilityState?.expanded,
          'aria-label': accessibilityLabel,
          onClick: onPress,
          role: accessibilityRole,
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
    View: ({
      children,
      testID,
    }: {
      children?: React.ReactNode;
      testID?: string;
    }) => React.createElement('div', { 'data-testid': testID }, children),
  };
});

const colors = {
  inputBg: '#f8fafc',
  text: '#0f172a',
  textMuted: '#94a3b8',
  textSecondary: '#64748b',
} as unknown as ThemeColors;

describe('ProductVariantsCardHeader', () => {
  it('shows stock summary and collapsed help state', () => {
    render(
      <ProductVariantsCardHeader
        colors={colors}
        onToggleHelp={vi.fn()}
        showHelp={false}
        totalStock={7}
        variantCount={3}
      />
    );

    expect(screen.getByText('Variants')).toBeInTheDocument();
    expect(screen.getByText('3 variants • 7 in stock')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'How variants work' })
    ).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByTestId('variants-help')).not.toBeInTheDocument();
  });

  it('renders the zero-variant fallback and help panel when expanded', () => {
    const onToggleHelp = vi.fn();

    render(
      <ProductVariantsCardHeader
        colors={colors}
        onToggleHelp={onToggleHelp}
        showHelp={true}
        totalStock={0}
        variantCount={0}
      />
    );

    expect(
      screen.getByText('Pricing and stock come from the variants you add')
    ).toBeInTheDocument();
    expect(screen.getByTestId('variants-help')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'How variants work' });
    expect(button).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(button);

    expect(onToggleHelp).toHaveBeenCalledTimes(1);
  });
});
