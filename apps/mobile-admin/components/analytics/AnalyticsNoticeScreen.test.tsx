import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AnalyticsNoticeScreen } from './AnalyticsNoticeScreen';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
  __esModule: true,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Pressable: ({
      children,
      onPress,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        { onClick: () => onPress?.(), type: 'button' },
        children
      ),
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock('expo-router', () => ({
  Stack: { Screen: () => null },
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#000',
      primary: '#3b82f6',
      text: '#fff',
      textSecondary: '#aaa',
    },
    shadows: { sm: {} },
  }),
}));

describe('AnalyticsNoticeScreen', () => {
  it('renders the notice title and message', () => {
    render(
      <AnalyticsNoticeScreen
        icon="lock-closed-outline"
        title="Owner-only settings"
        message="Analytics credentials can only be managed by the store owner."
      />
    );

    expect(screen.getByText('Owner-only settings')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Analytics credentials can only be managed by the store owner.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders the action button and forwards presses', () => {
    // Arrange
    const onPress = vi.fn();

    // Act
    render(
      <AnalyticsNoticeScreen
        icon="cloud-offline-outline"
        title="Couldn't load analytics settings"
        message="Check your connection and try again."
        action={{ label: 'Retry', onPress }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    // Assert
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
