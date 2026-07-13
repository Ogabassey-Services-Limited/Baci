import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import SalesChannelsScreen from './sales-channels';

vi.mock('react-native', () => {
  type NativeProps = {
    children?: React.ReactNode;
    onPress?: () => void;
    style?: unknown;
  };
  const styleAttribute = (style: unknown) => ({
    'data-style': JSON.stringify(style),
  });

  return {
    StatusBar: () => null,
    StyleSheet: { create: <T,>(s: T) => s },
    View: ({ children, style }: NativeProps) =>
      React.createElement('div', styleAttribute(style), children),
    Text: ({ children, style }: NativeProps) =>
      React.createElement('span', styleAttribute(style), children),
    Pressable: ({ children, onPress, style }: NativeProps) =>
      React.createElement(
        'button',
        { ...styleAttribute(style), onClick: onPress, type: 'button' },
        children
      ),
    ScrollView: ({ children, style }: NativeProps) =>
      React.createElement('div', styleAttribute(style), children),
  };
});

vi.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ back: vi.fn() }),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => children,
}));

vi.mock('@/components/billing/FeatureGateScreen', () => ({
  FeatureGateScreen: ({ children }: { children?: React.ReactNode }) => children,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#0D0D1A',
      card: '#1A1A2E',
      text: '#FFFFFF',
      textSecondary: '#9CA3AF',
      primary: '#4A90D9',
      textOnPrimary: '#FFFFFF',
    },
    shadows: {},
    isDark: true,
  }),
}));

vi.mock('@/components/marketplace/JumiaChannelCard', () => ({
  JumiaChannelCard: () => null,
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: ({ color, name }: { color?: string; name: string }) =>
    React.createElement('span', {
      'data-color': color,
      'data-testid': `icon-${name}`,
    }),
}));

describe('SalesChannelsScreen', () => {
  it('applies dynamic theme tokens to pending marketplace icons', () => {
    render(<SalesChannelsScreen />);

    expect(screen.getByText('Konga')).toBeInTheDocument();
    expect(screen.getByText('Amazon')).toBeInTheDocument();
    expect(screen.getByText('K')).toHaveAttribute(
      'data-style',
      expect.stringContaining('#FFFFFF')
    );
    expect(screen.getByText('K').parentElement).toHaveAttribute(
      'data-style',
      expect.stringContaining('#4A90D9')
    );
    expect(screen.getByTestId('icon-logo-amazon')).toHaveAttribute(
      'data-color',
      '#0D0D1A'
    );
  });
});
