import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import { ProductStatusCard } from './ProductStatusCard';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Switch: ({
      accessibilityLabel,
      disabled,
      onValueChange,
      value,
    }: {
      accessibilityLabel?: string;
      disabled?: boolean;
      onValueChange?: (value: boolean) => void;
      value?: boolean;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel,
        checked: value ?? false,
        disabled,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onValueChange?.(event.target.checked),
        type: 'checkbox',
      }),
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

describe('ProductStatusCard', () => {
  const colors = {
    border: '#e2e8f0',
    card: '#ffffff',
    inputBg: '#f8fafc',
    primary: '#2563eb',
    text: '#0f172a',
    textSecondary: '#64748b',
  } as unknown as ThemeColors;

  it('reports switch changes and renders the active status copy', () => {
    const onValueChange = vi.fn();

    render(
      <ProductStatusCard
        colors={colors}
        isPending={false}
        onValueChange={onValueChange}
        status="active"
      />
    );

    expect(screen.getByText('Product is visible to customers.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox'));

    expect(onValueChange).toHaveBeenCalledWith(false);
  });

  it('keeps archived products relistable from the status card', () => {
    const onValueChange = vi.fn();

    render(
      <ProductStatusCard
        colors={colors}
        isPending={false}
        onValueChange={onValueChange}
        status="archived"
      />
    );

    expect(
      screen.getByText('Product is archived. Turn it back on to relist it.')
    ).toBeInTheDocument();
    expect(screen.getByText('Archived')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Reactivate product' }));

    expect(onValueChange).toHaveBeenCalledWith(true);
  });
});
