import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import { ProductDeleteCard } from './ProductDeleteCard';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Alert: { alert: mocks.alert },
    Pressable: ({
      accessibilityLabel,
      children,
      disabled,
      onPress,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          disabled,
          onClick: () => onPress?.(),
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

const colors = {
  border: '#334155',
  card: '#111827',
  error: '#ef4444',
  errorLight: '#fee2e2',
  text: '#f8fafc',
  textSecondary: '#cbd5e1',
} as unknown as ThemeColors;

function getConfirmButton() {
  const buttons = mocks.alert.mock.calls[0]?.[2] as
    | Array<{ onPress?: () => void; text?: string }>
    | undefined;
  return buttons?.find((button) => button.text === 'Delete');
}

describe('ProductDeleteCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('confirms before deleting the product', async () => {
    const onConfirmDelete = vi.fn().mockResolvedValue(undefined);

    render(
      <ProductDeleteCard
        colors={colors}
        disabled={false}
        onConfirmDelete={onConfirmDelete}
        productName="Phone Ultra"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete product' }));

    expect(mocks.alert).toHaveBeenCalledWith(
      'Delete Product',
      expect.stringContaining('"Phone Ultra"'),
      expect.arrayContaining([
        expect.objectContaining({ style: 'cancel', text: 'Cancel' }),
        expect.objectContaining({ style: 'destructive', text: 'Delete' }),
      ])
    );

    getConfirmButton()?.onPress?.();

    await waitFor(() => {
      expect(onConfirmDelete).toHaveBeenCalledTimes(1);
    });
  });

  it('reports delete failures from the confirmation action', async () => {
    const onConfirmDelete = vi
      .fn()
      .mockRejectedValue(new Error('Archive failed'));

    render(
      <ProductDeleteCard
        colors={colors}
        disabled={false}
        onConfirmDelete={onConfirmDelete}
        productName="Phone Ultra"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete product' }));
    getConfirmButton()?.onPress?.();

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenLastCalledWith(
        'Delete Failed',
        'Archive failed'
      );
    });
  });

  it('disables the delete action while pending', () => {
    render(
      <ProductDeleteCard
        colors={colors}
        disabled
        onConfirmDelete={vi.fn()}
        productName="Phone Ultra"
      />
    );

    expect(
      screen.getByRole('button', { name: 'Delete product' })
    ).toBeDisabled();
  });
});
