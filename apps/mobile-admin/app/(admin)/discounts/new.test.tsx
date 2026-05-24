import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

const THEME_BORDER = '#11aa55';

vi.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ back: vi.fn() }),
}));

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: () => null,

  default: () => null,
  __esModule: true,
}));

vi.mock('@react-native-community/datetimepicker', () => ({
  default: () => null,
}));

vi.mock('@/components/discounts/DiscountItemSelector', () => ({
  DiscountItemSelector: () => null,
}));

vi.mock('@/hooks/useDiscounts', () => ({
  useDiscounts: () => ({
    createDiscount: vi.fn(),
    isCreating: false,
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#000000',
      border: THEME_BORDER,
      card: '#111111',
      error: '#ff0000',
      primary: '#0099ff',
      text: '#ffffff',
      textMuted: '#888888',
      textOnPrimary: '#000000',
    },
  }),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  type HostProps = {
    children?: React.ReactNode;
    onBlur?: () => void;
    onChangeText?: (text: string) => void;
    onPress?: () => void;
    placeholder?: string;
    style?: unknown;
    testID?: string;
    value?: string | number;
  };

  const toDomStyle = (style: unknown): React.CSSProperties | undefined => {
    if (!style) {
      return undefined;
    }

    if (Array.isArray(style)) {
      return Object.assign(
        {},
        ...style
          .flat(Infinity)
          .map(toDomStyle)
          .filter((entry): entry is React.CSSProperties => Boolean(entry))
      );
    }

    if (typeof style !== 'object') {
      return undefined;
    }

    return { ...(style as React.CSSProperties) };
  };

  const hostProps = (props: HostProps) => ({
    'data-testid': props.testID,
    style: toDomStyle(props.style),
  });

  return {
    ActivityIndicator: () =>
      React.createElement('div', { role: 'progressbar' }),
    Alert: { alert: vi.fn() },
    Pressable: ({ children, onPress, ...rest }: HostProps) =>
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: () => onPress?.(),
          ...hostProps(rest),
        },
        children
      ),
    ScrollView: ({ children, ...rest }: HostProps) =>
      React.createElement('div', hostProps(rest), children),
    StyleSheet: { create: <T,>(styles: T) => styles },
    Text: ({ children, ...rest }: HostProps) =>
      React.createElement('span', hostProps(rest), children),
    TextInput: ({ onBlur, onChangeText, value, ...rest }: HostProps) =>
      React.createElement('input', {
        ...hostProps(rest),
        onBlur,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        value: value ?? '',
      }),
    View: ({ children, ...rest }: HostProps) =>
      React.createElement('div', hostProps(rest), children),
  };
});

import NewDiscountScreen from './new';

describe('NewDiscountScreen theme styling', () => {
  it('applies the themed border color to specific item selectors', () => {
    render(<NewDiscountScreen />);

    fireEvent.click(screen.getByRole('button', { name: /Specific Products/i }));

    const productSelector = screen
      .getByText(/Selected Products:/i)
      .closest('div');

    expect(productSelector).toHaveStyle({ borderColor: THEME_BORDER });

    fireEvent.click(
      screen.getByRole('button', { name: /Specific Categories/i })
    );

    const categorySelector = screen
      .getByText(/Selected Categories:/i)
      .closest('div');

    expect(categorySelector).toHaveStyle({ borderColor: THEME_BORDER });
  });
});
