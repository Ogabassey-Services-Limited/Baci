import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS, SHADOWS } from '@/constants/theme';
import { StoreSubscriptionCard } from './StoreSubscriptionCard';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock('react-native', () => ({
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: React.ReactNode;
    onPress?: () => void;
  }) => (
    <button
      aria-label={accessibilityLabel}
      onClick={() => onPress?.()}
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

describe('StoreSubscriptionCard', () => {
  it('renders upgrade state and opens subscription plans', () => {
    const onOpenSubscriptionPlans = vi.fn();

    render(
      <StoreSubscriptionCard
        colors={LIGHT_COLORS}
        isPro={false}
        manageSubscriptionLabel="Manage in App Store"
        onManageSubscription={vi.fn()}
        onOpenSubscriptionPlans={onOpenSubscriptionPlans}
        planLabel="Free"
        shadowStyle={SHADOWS.sm}
      />
    );

    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Manage in App Store' })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Upgrade to Pro' }));

    expect(onOpenSubscriptionPlans).toHaveBeenCalledTimes(1);
  });

  it('renders management actions for pro merchants', () => {
    const onManageSubscription = vi.fn();

    render(
      <StoreSubscriptionCard
        colors={LIGHT_COLORS}
        isPro={true}
        manageSubscriptionLabel="Manage in App Store"
        onManageSubscription={onManageSubscription}
        onOpenSubscriptionPlans={vi.fn()}
        planLabel="Pro"
        shadowStyle={SHADOWS.sm}
      />
    );

    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('Baci Pro')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Manage in App Store' })
    );

    expect(onManageSubscription).toHaveBeenCalledTimes(1);
  });
});
