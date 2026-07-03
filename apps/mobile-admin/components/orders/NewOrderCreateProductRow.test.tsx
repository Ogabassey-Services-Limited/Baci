import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NewOrderCreateProductRow } from './NewOrderCreateProductRow';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: () => null,
  __esModule: true,
}));

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
        { 'aria-label': accessibilityLabel, onClick: onPress, type: 'button' },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', null, children),
  };
});

describe('NewOrderCreateProductRow', () => {
  it('renders the create product action and calls onPress', () => {
    const onPress = vi.fn();

    render(
      <NewOrderCreateProductRow
        colors={{
          border: '#e2e8f0',
          card: '#ffffff',
          primary: '#2563eb',
          textSecondary: '#64748b',
        }}
        onPress={onPress}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create new product' }));

    expect(screen.getByText('Create New Product')).toBeInTheDocument();
    expect(screen.getByText('Add a new item to inventory')).toBeInTheDocument();
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
