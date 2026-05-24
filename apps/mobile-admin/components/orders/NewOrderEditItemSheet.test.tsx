import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { useNewOrderController } from '@/hooks/useNewOrderController';
import { NewOrderEditItemSheet } from './NewOrderEditItemSheet';

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: () => null,

  default: () => null,
  __esModule: true,
}));

vi.mock('@/components/ui/AppSheetModal', () => ({
  AppSheetModal: ({
    accessibilityLabel,
    children,
    onClose,
    visible,
  }: {
    accessibilityLabel: string;
    children?: React.ReactNode;
    onClose: () => void;
    visible: boolean;
  }) =>
    visible ? (
      <section aria-label={accessibilityLabel}>
        <button
          aria-label="Close edit item modal"
          onClick={onClose}
          type="button"
        />
        {children}
      </section>
    ) : null,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
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
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      multiline,
      onChangeText,
      placeholder,
      value,
    }: {
      multiline?: boolean;
      onChangeText?: (value: string) => void;
      placeholder?: string;
      value?: string;
    }) =>
      multiline
        ? React.createElement('textarea', {
            'aria-label': placeholder,
            onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
              onChangeText?.(event.target.value),
            value: value ?? '',
          })
        : React.createElement('input', {
            onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
              onChangeText?.(event.target.value),
            value: value ?? '',
          }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

type EditItemController = Pick<
  ReturnType<typeof useNewOrderController>,
  | 'colors'
  | 'editDetails'
  | 'editingItem'
  | 'editPriceValue'
  | 'editQtyValue'
  | 'setEditDetails'
  | 'setEditPriceValue'
  | 'setEditQtyValue'
  | 'setOrderItems'
  | 'setShowEditItemModal'
  | 'showEditItemModal'
>;

function makeController(
  overrides: Partial<EditItemController> = {}
): ReturnType<typeof useNewOrderController> {
  return {
    colors: {
      backgroundLight: '#f8fafc',
      border: '#e2e8f0',
      card: '#ffffff',
      error: '#dc2626',
      primary: '#2563eb',
      text: '#0f172a',
      textMuted: '#94a3b8',
      textOnPrimary: '#ffffff',
    },
    editDetails: 'Original note',
    editingItem: {
      details: 'Original note',
      id: 'item-1',
      image_url: undefined,
      name: 'Baci Phone',
      price: 1500,
      product_id: 'product-1',
      quantity: 2,
      variant_id: null,
      variant_name: null,
    },
    editPriceValue: '1,500',
    editQtyValue: '2',
    setEditDetails: vi.fn(),
    setEditPriceValue: vi.fn(),
    setEditQtyValue: vi.fn(),
    setOrderItems: vi.fn(),
    setShowEditItemModal: vi.fn(),
    showEditItemModal: true,
    ...overrides,
  } as ReturnType<typeof useNewOrderController>;
}

describe('NewOrderEditItemSheet', () => {
  it('forwards price, quantity, and detail edits with sanitized values', () => {
    const controller = makeController();

    render(<NewOrderEditItemSheet controller={controller} />);

    const inputs = screen.getAllByRole('textbox');

    fireEvent.change(inputs[0], { target: { value: '12a.34' } });
    fireEvent.change(inputs[1], { target: { value: '' } });
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Description (optional)' }),
      {
        target: { value: 'Updated note' },
      }
    );

    expect(controller.setEditPriceValue).toHaveBeenCalledWith('12.34');
    expect(controller.setEditQtyValue).toHaveBeenCalledWith('');
    expect(controller.setEditDetails).toHaveBeenCalledWith('Updated note');
  });

  it('removes the editing item from the order and closes the modal', () => {
    const setOrderItems = vi.fn();
    const controller = makeController({
      setOrderItems: setOrderItems as EditItemController['setOrderItems'],
    });

    render(<NewOrderEditItemSheet controller={controller} />);

    fireEvent.click(screen.getByText('Remove').closest('button')!);

    expect(setOrderItems).toHaveBeenCalledTimes(1);
    const updater = setOrderItems.mock.calls[0][0] as (
      items: Array<{ id: string }>
    ) => Array<{ id: string }>;

    expect(updater([{ id: 'item-1' }, { id: 'item-2' }])).toEqual([
      { id: 'item-2' },
    ]);
    expect(controller.setShowEditItemModal).toHaveBeenCalledWith(false);
  });

  it('clamps the saved quantity to at least one before persisting', () => {
    const setOrderItems = vi.fn();
    const controller = makeController({
      editDetails: 'Special packaging',
      editPriceValue: '2,750.50',
      editQtyValue: '0',
      setOrderItems: setOrderItems as EditItemController['setOrderItems'],
    });

    render(<NewOrderEditItemSheet controller={controller} />);

    fireEvent.click(screen.getByText('Save').closest('button')!);

    const updater = setOrderItems.mock.calls[0][0] as (
      items: Array<{
        details?: string;
        id: string;
        name: string;
        price: number;
        quantity: number;
      }>
    ) => Array<{
      details?: string;
      id: string;
      name: string;
      price: number;
      quantity: number;
    }>;

    expect(
      updater([
        {
          details: 'Old note',
          id: 'item-1',
          name: 'Baci Phone',
          price: 1500,
          quantity: 2,
        },
      ])
    ).toEqual([
      {
        details: 'Special packaging',
        id: 'item-1',
        name: 'Baci Phone',
        price: 2750.5,
        quantity: 1,
      },
    ]);
    expect(controller.setShowEditItemModal).toHaveBeenCalledWith(false);
  });
});
