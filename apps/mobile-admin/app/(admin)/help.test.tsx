import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

const themeTextOnPrimary = '#123456';

type StyleInput =
  | React.CSSProperties
  | readonly StyleInput[]
  | null
  | undefined
  | false;

type NativeProps = {
  children?: React.ReactNode;
  onPress?: () => void;
  style?: StyleInput;
};

function isStyleList(style: StyleInput): style is readonly StyleInput[] {
  return Array.isArray(style);
}

function flattenStyle(style: StyleInput): React.CSSProperties {
  if (!style) return {};
  if (isStyleList(style)) {
    const merged: React.CSSProperties = {};
    for (const item of style) {
      Object.assign(merged, flattenStyle(item));
    }
    return merged;
  }

  return style;
}

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Linking: { openURL: vi.fn() },
    Pressable: ({ children, onPress, style }: NativeProps) =>
      React.createElement(
        'button',
        {
          onClick: onPress,
          style: flattenStyle(style),
          type: 'button',
        },
        children
      ),
    ScrollView: ({ children, style }: NativeProps) =>
      React.createElement('div', { style: flattenStyle(style) }, children),
    StatusBar: () => null,
    StyleSheet: {
      create: <T,>(styles: T) => styles,
    },
    Text: ({ children, style }: NativeProps) => {
      const flattenedStyle = flattenStyle(style);
      return React.createElement(
        'span',
        {
          'data-style-color': flattenedStyle.color,
          'data-style-opacity': String(flattenedStyle.opacity ?? ''),
        },
        children
      );
    },
    View: ({ children, style }: NativeProps) =>
      React.createElement('div', { style: flattenStyle(style) }, children),
  };
});

vi.mock('react-native-safe-area-context', async () => {
  const React = await import('react');
  return {
    SafeAreaView: ({ children, style }: NativeProps) =>
      React.createElement('main', { style: flattenStyle(style) }, children),
  };
});

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: ({ color, name }: { color?: string; name: string }) => (
    <span data-color={color} data-testid={`icon-${name}`} />
  ),
  __esModule: true,
}));

vi.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  useRouter: () => ({ back: vi.fn() }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      border: '#d1d5db',
      card: '#ffffff',
      cardHover: '#f3f4f6',
      primary: '#2563eb',
      text: '#111827',
      textMuted: '#6b7280',
      textOnPrimary: themeTextOnPrimary,
      textSecondary: '#4b5563',
    },
    isDark: false,
    shadows: { sm: {} },
  }),
}));

import HelpCenterScreen from './help';

describe('HelpCenterScreen', () => {
  it('uses the theme textOnPrimary token for the help search affordance', () => {
    render(<HelpCenterScreen />);

    expect(screen.getByTestId('icon-search')).toHaveAttribute(
      'data-color',
      themeTextOnPrimary
    );

    const searchText = screen.getByText('Search help articles…');
    expect(searchText).toHaveAttribute('data-style-color', themeTextOnPrimary);
    expect(searchText).toHaveAttribute('data-style-opacity', '0.8');
  });
});
