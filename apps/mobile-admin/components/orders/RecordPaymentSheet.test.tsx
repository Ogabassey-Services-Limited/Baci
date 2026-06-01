import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RecordPaymentSheet } from './RecordPaymentSheet';

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
          aria-label="Close payment sheet"
          onClick={onClose}
          type="button"
        />
        {children}
      </section>
    ) : null,
}));

// Project-standard react-native shim for component-level tests.
// Mirrors the minimal stub used across apps/mobile-admin component tests
// (see NewOrderChannelSection.test.tsx, OrderItemDetailModal.test.tsx) so
// each test file stays self-contained. Keep the surface area here tight —
// only props these tests assert on need mapping; additional props should
// be added when a test needs them, not preemptively.
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

describe('RecordPaymentSheet', () => {
  const colors = {
    border: '#e2e8f0',
    card: '#ffffff',
    primary: '#2563eb',
    success: '#16a34a',
    text: '#0f172a',
    textOnPrimary: '#ffffff',
    textSecondary: '#64748b',
  };

  it('updates payment fields and confirms a manual payment', () => {
    const onAmountChange = vi.fn();
    const onMethodChange = vi.fn();
    const onNotesChange = vi.fn();
    const onConfirm = vi.fn();

    render(
      <RecordPaymentSheet
        colors={colors}
        currencySymbol="₦"
        isConfirmDisabled={false}
        isSubmitting={false}
        onAmountChange={onAmountChange}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        onMethodChange={onMethodChange}
        onNotesChange={onNotesChange}
        paymentAmount="5000"
        paymentMethod=""
        paymentNotes=""
        visible={true}
      />
    );

    fireEvent.change(screen.getByLabelText('Payment amount'), {
      target: { value: '7500' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Payment method transfer' })
    );
    fireEvent.change(screen.getByLabelText('Payment notes'), {
      target: { value: 'Received by John' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm payment' }));

    expect(onAmountChange).toHaveBeenCalledWith('7500');
    expect(onMethodChange).toHaveBeenCalledWith('transfer');
    expect(onNotesChange).toHaveBeenCalledWith('Received by John');
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('invokes onClose from the close control', () => {
    const onClose = vi.fn();

    render(
      <RecordPaymentSheet
        colors={colors}
        currencySymbol="₦"
        isConfirmDisabled={false}
        isSubmitting={false}
        onAmountChange={vi.fn()}
        onClose={onClose}
        onConfirm={vi.fn()}
        onMethodChange={vi.fn()}
        onNotesChange={vi.fn()}
        paymentAmount=""
        paymentMethod=""
        paymentNotes=""
        visible={true}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Close payment sheet' })
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables confirm when confirmation is not allowed', () => {
    render(
      <RecordPaymentSheet
        colors={colors}
        currencySymbol="₦"
        isConfirmDisabled={true}
        isSubmitting={false}
        onAmountChange={vi.fn()}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        onMethodChange={vi.fn()}
        onNotesChange={vi.fn()}
        paymentAmount=""
        paymentMethod=""
        paymentNotes=""
        visible={true}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Confirm payment' })
    ).toBeDisabled();
  });

  it('shows a loading state while submitting', () => {
    render(
      <RecordPaymentSheet
        colors={colors}
        currencySymbol="₦"
        isConfirmDisabled={false}
        isSubmitting={true}
        onAmountChange={vi.fn()}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        onMethodChange={vi.fn()}
        onNotesChange={vi.fn()}
        paymentAmount=""
        paymentMethod=""
        paymentNotes=""
        visible={true}
      />
    );

    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Confirm payment' })
    ).toBeDisabled();
  });

  it('does not render when hidden', () => {
    render(
      <RecordPaymentSheet
        colors={colors}
        currencySymbol="₦"
        isConfirmDisabled={false}
        isSubmitting={false}
        onAmountChange={vi.fn()}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        onMethodChange={vi.fn()}
        onNotesChange={vi.fn()}
        paymentAmount=""
        paymentMethod=""
        paymentNotes=""
        visible={false}
      />
    );

    expect(
      screen.queryByLabelText('Record payment sheet')
    ).not.toBeInTheDocument();
  });

  it('shows empty string for a non-numeric paymentAmount (NaN-safe display)', () => {
    render(
      <RecordPaymentSheet
        colors={colors}
        currencySymbol="₦"
        isConfirmDisabled={false}
        isSubmitting={false}
        onAmountChange={vi.fn()}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        onMethodChange={vi.fn()}
        onNotesChange={vi.fn()}
        paymentAmount="abc"
        paymentMethod=""
        paymentNotes=""
        visible={true}
      />
    );

    // "abc" strips to "" → Number("") is 0 but raw is "" so displayedAmount = ""
    const input = screen.getByLabelText('Payment amount') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('prepends zero when input starts with a decimal point (leading-zero guard)', () => {
    const onAmountChange = vi.fn();

    render(
      <RecordPaymentSheet
        colors={colors}
        currencySymbol="₦"
        isConfirmDisabled={false}
        isSubmitting={false}
        onAmountChange={onAmountChange}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        onMethodChange={vi.fn()}
        onNotesChange={vi.fn()}
        paymentAmount=""
        paymentMethod=""
        paymentNotes=""
        visible={true}
      />
    );

    fireEvent.change(screen.getByLabelText('Payment amount'), {
      target: { value: '.5' },
    });

    // ".5" → digits ".5" → normalized ".5" → starts with "." → "0.5"
    expect(onAmountChange).toHaveBeenCalledWith('0.5');
  });

  it('strips non-numeric characters from the amount input', () => {
    const onAmountChange = vi.fn();

    render(
      <RecordPaymentSheet
        colors={colors}
        currencySymbol="₦"
        isConfirmDisabled={false}
        isSubmitting={false}
        onAmountChange={onAmountChange}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        onMethodChange={vi.fn()}
        onNotesChange={vi.fn()}
        paymentAmount=""
        paymentMethod=""
        paymentNotes=""
        visible={true}
      />
    );

    fireEvent.change(screen.getByLabelText('Payment amount'), {
      target: { value: '1,500abc' },
    });

    // Non-digit, non-dot chars stripped → "1500abc" → "1500"
    expect(onAmountChange).toHaveBeenCalledWith('1500');
  });
});
