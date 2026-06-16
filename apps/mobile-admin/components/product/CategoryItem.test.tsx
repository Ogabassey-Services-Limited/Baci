import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CategoryItem } from './CategoryItem';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: () => null,
  Ionicons: () => null,
  __esModule: true,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      card: '#ffffff',
      cardHover: '#f1f5f9',
      gold: '#d97706',
      goldLight: '#fef3c7',
      text: '#0f172a',
      textMuted: '#94a3b8',
    },
    shadows: { sm: {} },
  }),
}));

vi.mock('react-native', async () => {
  const React = await import('react');
  return {
    Pressable: ({
      accessibilityHint,
      accessibilityLabel,
      children,
      onPress,
    }: {
      accessibilityHint?: string;
      accessibilityLabel?: string;
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-description': accessibilityHint,
          'aria-label': accessibilityLabel,
          onClick: () => onPress?.(),
          type: 'button',
        },
        children
      ),
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

describe('CategoryItem', () => {
  it('renders the category name and opens the category when pressed', () => {
    const onPress = vi.fn();
    render(
      <CategoryItem
        item={{ id: 'category-1', name: 'Phones', slug: 'phones' }}
        onPress={onPress}
      />
    );

    expect(screen.getByText('Phones')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Category: Phones' }));

    expect(onPress).toHaveBeenCalledWith('category-1');
  });
});
