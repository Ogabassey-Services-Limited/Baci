import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PriceInput } from './PriceInput';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      accessibilityLabel,
      onBlur,
      onChangeText,
      onFocus,
      placeholder,
      value,
    }: {
      accessibilityLabel?: string;
      onBlur?: () => void;
      onChangeText?: (text: string) => void;
      onFocus?: () => void;
      placeholder?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel,
        placeholder,
        value: value ?? '',
        onBlur,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        onFocus,
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

describe('PriceInput', () => {
  const colors = {
    border: '#e2e8f0',
    inputBg: '#f8fafc',
    text: '#0f172a',
    textSecondary: '#64748b',
  };

  it('formats the initial value using thousand separators', () => {
    render(
      <PriceInput
        accessibilityLabel="Selling price"
        colors={colors}
        currencySymbol="₦"
        onChange={vi.fn()}
        placeholder="0.00"
        value={12500}
      />
    );

    expect(screen.getByLabelText('Selling price')).toHaveValue('12,500');
  });

  it('normalizes numeric text before reporting changes', () => {
    const onChange = vi.fn();

    render(
      <PriceInput
        accessibilityLabel="Cost price"
        colors={colors}
        currencySymbol="₦"
        onChange={onChange}
        placeholder="0.00"
        value={0}
      />
    );

    const input = screen.getByLabelText('Cost price');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1,230.50' } });

    expect(onChange).toHaveBeenLastCalledWith(1230.5);
    expect(input).toHaveValue('1,230.50');
  });
});
