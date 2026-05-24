import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import { ProductStockControls } from './ProductStockControls';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Pressable: ({
      accessibilityLabel,
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      children?: ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          onClick: () => onPress?.(),
          type: 'button',
        },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      accessibilityLabel,
      onChangeText,
      placeholder,
      value,
    }: {
      accessibilityLabel?: string;
      onChangeText?: (value: string) => void;
      placeholder?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel ?? placeholder,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        value: value ?? '',
      }),
    View: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: () => null,

  default: () => null,
  __esModule: true,
}));

describe('ProductStockControls', () => {
  const colors = {
    border: '#e2e8f0',
    error: '#dc2626',
    inputBg: '#f8fafc',
    success: '#16a34a',
    text: '#0f172a',
    textOnPrimary: '#ffffff',
    textSecondary: '#64748b',
  } as unknown as ThemeColors;

  it('clamps manual and button-based stock changes to zero or above', () => {
    const onLowStockThresholdChange = vi.fn();
    const onStockAdjust = vi.fn();

    render(
      <ProductStockControls
        colors={colors}
        lowStockThreshold={3}
        onLowStockThresholdChange={onLowStockThresholdChange}
        onStockAdjust={onStockAdjust}
        stockQuantity={0}
      />
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Stock quantity' }), {
      target: { value: '-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Decrease stock' }));
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Low stock threshold' }),
      {
        target: { value: '-5' },
      }
    );

    expect(onStockAdjust).toHaveBeenCalledWith(0);
    expect(onStockAdjust).toHaveBeenCalledWith(0);
    expect(onLowStockThresholdChange).toHaveBeenCalledWith(0);
  });
});
