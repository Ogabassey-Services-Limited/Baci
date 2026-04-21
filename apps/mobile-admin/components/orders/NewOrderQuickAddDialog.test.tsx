import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NewOrderQuickAddDialog } from './NewOrderQuickAddDialog';

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
      onChangeText,
      placeholder,
      value,
    }: {
      onChangeText?: (text: string) => void;
      placeholder?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        onChange: (event: { target: { value: string } }) =>
          onChangeText?.(event.target.value),
        placeholder,
        value: value ?? '',
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@/components/ui/AppDialogModal', () => ({
  AppDialogModal: ({
    children,
    visible,
  }: {
    children?: React.ReactNode;
    visible?: boolean;
  }) => (visible ? React.createElement('div', null, children) : null),
}));

vi.mock('./new-order.styles', () => ({ styles: {} }));
vi.mock('./new-order.shared', () => ({
  formatPriceInput: (value: string | undefined) => value ?? '',
}));

type ControllerShape = {
  colors: {
    card: string;
    inputBg: string;
    success: string;
    text: string;
    textMuted: string;
    textOnPrimary: string;
    textSecondary: string;
  };
  customItem: { name: string; price: string };
  handleAddCustomItem: ReturnType<typeof vi.fn>;
  setCustomItem: ReturnType<typeof vi.fn>;
  setShowCustomItemModal: ReturnType<typeof vi.fn>;
  showCustomItemModal: boolean;
};

const makeController = (
  overrides: Partial<ControllerShape> = {}
): ControllerShape => ({
  colors: {
    card: '#ffffff',
    inputBg: '#f8fafc',
    success: '#16a34a',
    text: '#0f172a',
    textMuted: '#94a3b8',
    textOnPrimary: '#ffffff',
    textSecondary: '#64748b',
  },
  customItem: { name: '', price: '' },
  handleAddCustomItem: vi.fn(),
  setCustomItem: vi.fn(),
  setShowCustomItemModal: vi.fn(),
  showCustomItemModal: true,
  ...overrides,
});

describe('NewOrderQuickAddDialog', () => {
  it('renders the dialog with title and inputs when visible', () => {
    const controller = makeController();

    render(
      <NewOrderQuickAddDialog
        controller={
          controller as unknown as React.ComponentProps<
            typeof NewOrderQuickAddDialog
          >['controller']
        }
      />
    );

    expect(screen.getByText('Quick Add Item')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Item Name (e.g. Red Cake, Delivery)')
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Amount (0.00)')).toBeInTheDocument();
  });

  it('does not render when showCustomItemModal is false', () => {
    const controller = makeController({ showCustomItemModal: false });

    render(
      <NewOrderQuickAddDialog
        controller={
          controller as unknown as React.ComponentProps<
            typeof NewOrderQuickAddDialog
          >['controller']
        }
      />
    );

    expect(screen.queryByText('Quick Add Item')).not.toBeInTheDocument();
  });

  it('rejects non-numeric characters in the price input', () => {
    const controller = makeController();

    render(
      <NewOrderQuickAddDialog
        controller={
          controller as unknown as React.ComponentProps<
            typeof NewOrderQuickAddDialog
          >['controller']
        }
      />
    );

    const priceInput = screen.getByPlaceholderText('Amount (0.00)');
    fireEvent.change(priceInput, { target: { value: 'abc' } });

    // setCustomItem is called with a setter function — invoke it to inspect the result
    expect(controller.setCustomItem).toHaveBeenCalledTimes(1);
    const updater = controller.setCustomItem.mock.calls[0][0] as (prev: {
      name: string;
      price: string;
    }) => { name: string; price: string };
    const result = updater({ name: '', price: '' });
    // Non-numeric input should be stripped to an empty string
    expect(result.price).toBe('');
  });

  it('calls handleAddCustomItem when "Add to Cart" is pressed', () => {
    const controller = makeController({
      customItem: { name: 'Delivery', price: '500' },
    });

    render(
      <NewOrderQuickAddDialog
        controller={
          controller as unknown as React.ComponentProps<
            typeof NewOrderQuickAddDialog
          >['controller']
        }
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add to Cart' }));

    expect(controller.handleAddCustomItem).toHaveBeenCalledTimes(1);
  });
});
