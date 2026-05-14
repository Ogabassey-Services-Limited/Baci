import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { StaffAccountsStatusShell } from './StaffAccountsStatusShell';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => <span data-icon={name} />,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('react-native', () => ({
  ActivityIndicator: ({
    accessibilityLabel,
  }: {
    accessibilityLabel?: string;
  }) => <span aria-label={accessibilityLabel}>loading</span>,
  Pressable: ({
    accessibilityLabel,
    accessibilityRole,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    accessibilityRole?: string;
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button
      aria-label={accessibilityLabel}
      onClick={() => onPress?.()}
      role={accessibilityRole}
      type="button"
    >
      {children}
    </button>
  ),
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

describe('StaffAccountsStatusShell', () => {
  it('renders the loading state', () => {
    render(<StaffAccountsStatusShell colors={LIGHT_COLORS} status="loading" />);

    expect(screen.getByLabelText('Loading staff accounts')).toBeInTheDocument();
  });

  it('renders the error state', () => {
    render(<StaffAccountsStatusShell colors={LIGHT_COLORS} status="error" />);

    expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    expect(
      screen.getByText('Please check your connection and try again.')
    ).toBeInTheDocument();
  });

  it('retries loading data from the error state', () => {
    const onRetry = vi.fn();

    render(
      <StaffAccountsStatusShell
        colors={LIGHT_COLORS}
        onRetry={onRetry}
        status="error"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Retry loading data' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
