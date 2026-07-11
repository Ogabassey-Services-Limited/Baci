import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import type { VariantAxis } from '@/lib/variant-group-pricing';
import { VariantFilterChips } from './VariantFilterChips';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      accessibilityState?: { selected?: boolean };
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          'aria-selected': accessibilityState?.selected,
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

describe('VariantFilterChips', () => {
  const colors = {
    border: '#e2e8f0',
    inputBg: '#f8fafc',
    primary: '#2563eb',
    primaryLight: 'rgba(37, 99, 235, 0.15)',
    text: '#0f172a',
  } as unknown as ThemeColors;

  const storageAxis: VariantAxis = {
    attributeKey: 'Storage',
    id: 'attr:storage',
    isCondition: false,
    label: 'Storage',
    valueLabels: { '128gb': '128GB', '64gb': '64GB' },
    values: ['64gb', '128gb'],
  };

  it('renders one chip per axis value', () => {
    render(
      <VariantFilterChips
        axes={[storageAxis]}
        colors={colors}
        onChange={vi.fn()}
        selection={{}}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Filter by Storage 64GB' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Filter by Storage 128GB' })
    ).toBeInTheDocument();
  });

  it('selects a value when an unselected chip is pressed', () => {
    const onChange = vi.fn();

    render(
      <VariantFilterChips
        axes={[storageAxis]}
        colors={colors}
        onChange={onChange}
        selection={{}}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Filter by Storage 64GB' })
    );

    expect(onChange).toHaveBeenCalledWith({ 'attr:storage': '64gb' });
  });

  it('clears the selection when the currently-selected chip is pressed again', () => {
    const onChange = vi.fn();

    render(
      <VariantFilterChips
        axes={[storageAxis]}
        colors={colors}
        onChange={onChange}
        selection={{ 'attr:storage': '64gb' }}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Filter by Storage 64GB' })
    );

    expect(onChange).toHaveBeenCalledWith({ 'attr:storage': null });
  });

  it('renders nothing when every axis has fewer than two values', () => {
    const singleValueAxis: VariantAxis = {
      id: 'condition',
      isCondition: true,
      label: 'Condition',
      valueLabels: { used: 'Used' },
      values: ['used'],
    };

    render(
      <VariantFilterChips
        axes={[singleValueAxis]}
        colors={colors}
        onChange={vi.fn()}
        selection={{}}
      />
    );

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
