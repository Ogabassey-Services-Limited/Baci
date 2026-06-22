import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { TaxCardShadow, TaxColors } from './types';
import { VatCard } from './VatCard';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,

  default: ({ name }: { name: string }) => <span>{name}</span>,
  __esModule: true,
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <output aria-label="loading" />,
  Pressable: ({
    'aria-checked': ariaChecked,
    accessibilityLabel,
    accessibilityHint,
    accessibilityRole,
    accessibilityState,
    children,
    disabled,
    onPress,
  }: {
    'aria-checked'?: boolean;
    accessibilityLabel?: string;
    accessibilityHint?: string;
    accessibilityRole?: string;
    accessibilityState?: { checked?: boolean; disabled?: boolean };
    children?: React.ReactNode;
    disabled?: boolean;
    onPress?: () => void;
  }) => (
    <button
      aria-checked={ariaChecked ?? accessibilityState?.checked}
      aria-disabled={accessibilityState?.disabled}
      aria-label={accessibilityLabel}
      disabled={disabled}
      onClick={() => onPress?.()}
      role={accessibilityRole}
      title={accessibilityHint}
      type="button"
    >
      {children}
    </button>
  ),
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: React.ReactNode }) => (
    <span>{children}</span>
  ),
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

describe('VatCard', () => {
  const colors = {
    backgroundLight: '#f8fafc',
    border: '#e2e8f0',
    card: '#ffffff',
    cardHover: '#f1f5f9',
    primary: '#3b82f6',
    success: '#10b981',
    successLight: '#d1fae5',
    text: '#0f172a',
    textMuted: '#94a3b8',
    textSecondary: '#64748b',
  } as unknown as TaxColors;

  const shadowStyle = {
    elevation: 0,
    shadowColor: '#000',
    shadowOffset: { height: 0, width: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  } satisfies TaxCardShadow;

  it('renders the toggle switch with correct accessibility properties when off', () => {
    const onToggle = vi.fn();
    render(
      <VatCard
        colors={colors}
        isPending={false}
        onToggle={onToggle}
        shadowStyle={shadowStyle}
        vatEnabled={false}
      />
    );

    const toggleBtn = screen.getByRole('switch', {
      name: 'Toggle VAT Collection',
    });
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute('aria-checked', 'false');
    expect(toggleBtn).not.toBeDisabled();

    fireEvent.click(toggleBtn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders the toggle switch with correct accessibility properties when on', () => {
    const onToggle = vi.fn();
    render(
      <VatCard
        colors={colors}
        isPending={false}
        onToggle={onToggle}
        shadowStyle={shadowStyle}
        vatEnabled={true}
      />
    );

    const toggleBtn = screen.getByRole('switch', {
      name: 'Toggle VAT Collection',
    });
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveAttribute('aria-checked', 'true');
    expect(toggleBtn).not.toBeDisabled();
  });

  it('renders disabled state and loading indicator when pending', () => {
    const onToggle = vi.fn();
    render(
      <VatCard
        colors={colors}
        isPending={true}
        onToggle={onToggle}
        shadowStyle={shadowStyle}
        vatEnabled={false}
      />
    );

    const toggleBtn = screen.getByRole('switch', {
      name: 'Toggle VAT Collection',
    });
    expect(toggleBtn).toBeDisabled();
    expect(toggleBtn).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByLabelText('loading')).toBeInTheDocument();
  });
});
