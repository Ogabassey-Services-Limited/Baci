import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import { VariantCardActions } from './VariantCardActions';

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
          onClick: () => onPress?.(),
          role: accessibilityRole,
          type: 'button',
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

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
  __esModule: true,
}));

describe('VariantCardActions', () => {
  const colors = {
    border: '#e2e8f0',
    primary: '#2563eb',
    textOnPrimary: '#ffffff',
  } as unknown as ThemeColors;

  it('opens the builder from the primary action', () => {
    const onOpenBuilder = vi.fn();

    render(
      <VariantCardActions
        colors={colors}
        onAddOne={vi.fn()}
        onOpenBuilder={onOpenBuilder}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Build variants from options' })
    );

    expect(onOpenBuilder).toHaveBeenCalledTimes(1);
  });

  it('adds one variant from the secondary action', () => {
    const onAddOne = vi.fn();

    render(
      <VariantCardActions
        colors={colors}
        onAddOne={onAddOne}
        onOpenBuilder={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Add product variant' })
    );

    expect(onAddOne).toHaveBeenCalledTimes(1);
  });
});
