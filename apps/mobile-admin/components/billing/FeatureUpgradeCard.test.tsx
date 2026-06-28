import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { FeatureUpgradeCard } from './FeatureUpgradeCard';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: ({ name }: { name: string }) => <span>{name}</span>,
  __esModule: true,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          role: accessibilityRole,
          type: 'button',
          onClick: onPress,
        },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

describe('FeatureUpgradeCard', () => {
  it('renders upgrade copy and calls the upgrade action', () => {
    const onUpgrade = vi.fn();

    render(
      <FeatureUpgradeCard
        colors={LIGHT_COLORS}
        description="Connect a branded domain when Baci Pro is active."
        onUpgrade={onUpgrade}
        title="Custom domains are a Baci Pro feature"
      />
    );

    expect(
      screen.getByText('Custom domains are a Baci Pro feature')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Connect a branded domain when Baci Pro is active.')
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Upgrade to Baci Pro' })
    );

    expect(onUpgrade).toHaveBeenCalledOnce();
  });
});
