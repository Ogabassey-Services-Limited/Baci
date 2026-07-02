import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors, ThemeShadows } from '@/constants/theme';
import { SubscriptionStatusCard } from './SubscriptionStatusCard';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: ({ name }: { name?: string }) => <span>{name}</span>,
  default: ({ name }: { name?: string }) => <span>{name}</span>,
  __esModule: true,
}));

vi.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <span role="progressbar">loading</span>,
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
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

const colors = {
  card: '#ffffff',
  gold: '#d4a03d',
  goldLight: 'rgba(212, 160, 61, 0.12)',
  primary: '#3b82f6',
  primaryLight: 'rgba(59, 130, 246, 0.1)',
  text: '#0f172a',
  textOnGold: '#111827',
  textOnPrimary: '#ffffff',
  textSecondary: '#64748b',
} as ThemeColors;

const shadows = {
  md: {},
  sm: {},
} as ThemeShadows;

describe('SubscriptionStatusCard', () => {
  it('renders a neutral loading card while subscription status is loading', () => {
    const onPress = vi.fn();

    render(
      <SubscriptionStatusCard
        colors={colors}
        customerInfo={null}
        isLoading={true}
        isPro={false}
        onPress={onPress}
        shadows={shadows}
      />
    );

    const loadingCard = screen.getByRole('button', {
      name: /checking subscription status/i,
    });

    expect(loadingCard).toBeDisabled();
    expect(screen.getByText('Checking plan')).toBeInTheDocument();
    expect(screen.getByText('Syncing subscription status')).toBeInTheDocument();
    expect(screen.queryByText('Free Plan')).toBeNull();

    fireEvent.click(loadingCard);
    expect(onPress).not.toHaveBeenCalled();
  });
});
