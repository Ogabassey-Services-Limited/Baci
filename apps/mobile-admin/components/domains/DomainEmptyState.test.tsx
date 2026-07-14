import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DomainEmptyState } from './DomainEmptyState';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: ({ name }: { name?: string }) => (
    <span aria-hidden="true" data-icon={name} />
  ),
  __esModule: true,
}));

vi.mock('react-native', () => ({
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
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
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      border: '#e2e8f0',
      card: '#f8fafc',
      primary: '#2563eb',
      primaryLight: '#dbeafe',
      text: '#0f172a',
      textOnPrimary: '#ffffff',
      textSecondary: '#475569',
    },
    shadows: { md: {} },
  }),
}));

describe('DomainEmptyState', () => {
  it('omits the purchase action when no buy callback is supplied', () => {
    render(<DomainEmptyState onConnectDomain={vi.fn()} />);

    expect(
      screen.queryByRole('button', { name: 'Get a custom domain' })
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'I already own a domain' })
    ).toBeTruthy();
  });

  it('renders and invokes the purchase action when a buy callback is supplied', () => {
    const onBuyDomain = vi.fn();
    render(
      <DomainEmptyState onBuyDomain={onBuyDomain} onConnectDomain={vi.fn()} />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Get a custom domain' })
    );

    expect(onBuyDomain).toHaveBeenCalledOnce();
  });
});
