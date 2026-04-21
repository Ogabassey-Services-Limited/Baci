import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import { ProductAttributesCard } from './ProductAttributesCard';

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
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
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
        'aria-label': accessibilityLabel,
        placeholder,
        value: value ?? '',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

describe('ProductAttributesCard', () => {
  const colors = {
    border: '#e2e8f0',
    card: '#ffffff',
    error: '#dc2626',
    inputBg: '#f8fafc',
    primary: '#2563eb',
    text: '#0f172a',
    textSecondary: '#64748b',
  } as unknown as ThemeColors;

  it('renders empty-state copy and delegates add actions', () => {
    const onAdd = vi.fn();

    render(
      <ProductAttributesCard
        attributes={[]}
        colors={colors}
        onAdd={onAdd}
        onRemove={vi.fn()}
        onUpdate={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(
      screen.getByText('No attributes defined (e.g. Storage, RAM).')
    ).toBeInTheDocument();
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('reports attribute edits and removals', () => {
    const onRemove = vi.fn();
    const onUpdate = vi.fn();

    render(
      <ProductAttributesCard
        attributes={[{ key: 'Storage', value: '256GB' }]}
        colors={colors}
        onAdd={vi.fn()}
        onRemove={onRemove}
        onUpdate={onUpdate}
      />
    );

    fireEvent.change(screen.getByLabelText('Attribute key 1'), {
      target: { value: 'Color' },
    });
    fireEvent.change(screen.getByLabelText('Attribute value 1'), {
      target: { value: 'Black' },
    });
    fireEvent.click(screen.getAllByRole('button')[1]);

    expect(onUpdate).toHaveBeenCalledWith(0, 'key', 'Color');
    expect(onUpdate).toHaveBeenCalledWith(0, 'value', 'Black');
    expect(onRemove).toHaveBeenCalledWith(0);
  });
});
