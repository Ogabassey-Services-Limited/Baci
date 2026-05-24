import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import SalesChannelsScreen from './sales-channels';

vi.mock('react-native', () => {
  const React = require('react');
  return {
    StyleSheet: { create: <T,>(s: T) => s },
    View: ({ children }: any) => React.createElement('div', null, children),
    Text: ({ children }: any) => React.createElement('span', null, children),
    Pressable: ({ children, onPress }: any) => React.createElement('button', { onClick: onPress }, children),
    ScrollView: ({ children }: any) => React.createElement('div', null, children),
  };
});

vi.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ back: vi.fn() }),
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
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

vi.mock('react-native-edge-to-edge', () => ({
  SystemBars: () => null,
}));

vi.mock('@/components/marketplace/JumiaChannelCard', () => ({
  JumiaChannelCard: () => null,
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

describe('SalesChannelsScreen', () => {
  it('renders correctly with dynamic theme colors', () => {
    render(<SalesChannelsScreen />);

    expect(screen.getByText('Konga')).toBeInTheDocument();
    expect(screen.getByText('Amazon')).toBeInTheDocument();
  });
});
