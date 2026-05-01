import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ShipOnCreditDialog } from './ShipOnCreditDialog';

vi.mock('@/components/ui/AppDialogModal', () => ({
  AppDialogModal: ({
    children,
    onClose,
    visible,
  }: {
    children?: React.ReactNode;
    onClose: () => void;
    visible: boolean;
  }) =>
    visible ? (
      <section aria-label="ship-on-credit-dialog">
        <button aria-label="Close dialog" onClick={onClose} type="button" />
        {children}
      </section>
    ) : null,
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: () => React.createElement('span', null, 'loading'),
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
    TextInput: ({
      accessibilityLabel,
      onChangeText,
      placeholder,
      value,
    }: {
      accessibilityLabel?: string;
      onChangeText?: (text: string) => void;
      placeholder?: string;
      value?: string;
    }) =>
      React.createElement('textarea', {
        'aria-label': accessibilityLabel,
        placeholder,
        value: value ?? '',
        onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
          onChangeText?.(event.target.value),
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

describe('ShipOnCreditDialog', () => {
  const colors = {
    border: '#e2e8f0',
    card: '#ffffff',
    text: '#0f172a',
    textOnPrimary: '#ffffff',
    textSecondary: '#64748b',
    warning: '#ca8a04',
  };

  it('forwards note changes and confirms the action', () => {
    const onCreditNotesChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ShipOnCreditDialog
        colors={colors}
        creditNotes=""
        isSubmitting={false}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        onCreditNotesChange={onCreditNotesChange}
        visible={true}
      />
    );

    fireEvent.change(screen.getByLabelText('Credit note'), {
      target: { value: 'Trusted customer' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm ship on credit' })
    );

    expect(onCreditNotesChange).toHaveBeenCalledWith('Trusted customer');
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('disables confirmation while submitting', () => {
    render(
      <ShipOnCreditDialog
        colors={colors}
        creditNotes=""
        isSubmitting={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        onCreditNotesChange={vi.fn()}
        visible={true}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Confirm ship on credit' })
    ).toBeDisabled();
  });

  it('does not render when hidden', () => {
    render(
      <ShipOnCreditDialog
        colors={colors}
        creditNotes=""
        isSubmitting={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        onCreditNotesChange={vi.fn()}
        visible={false}
      />
    );

    expect(
      screen.queryByLabelText('ship-on-credit-dialog')
    ).not.toBeInTheDocument();
  });

  it('renders prefilled notes and closes from the shared close control', () => {
    const onClose = vi.fn();

    render(
      <ShipOnCreditDialog
        colors={colors}
        creditNotes="Trusted customer"
        isSubmitting={false}
        onClose={onClose}
        onConfirm={vi.fn()}
        onCreditNotesChange={vi.fn()}
        visible={true}
      />
    );

    expect(screen.getByLabelText('Credit note')).toHaveValue(
      'Trusted customer'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
