import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PayoutBankDetailsForm } from './PayoutBankDetailsForm';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: () => <span>icon</span>,
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <span>loading</span>,
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button aria-label={accessibilityLabel} onClick={onPress} type="button">
      {children}
    </button>
  ),
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  TextInput: ({
    onChangeText,
    placeholder,
    value,
  }: {
    onChangeText?: (value: string) => void;
    placeholder?: string;
    value?: string;
  }) => (
    <input
      onChange={(event) => onChangeText?.(event.target.value)}
      placeholder={placeholder}
      value={value}
    />
  ),
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

const colors = {
  background: '#0b0b1a',
  border: '#e2e8f0',
  card: '#f8fafc',
  error: '#dc2626',
  info: '#0369a1',
  infoLight: '#e0f2fe',
  primary: '#2563eb',
  success: '#16a34a',
  successLight: '#dcfce7',
  text: '#0f172a',
  textMuted: '#64748b',
  textSecondary: '#334155',
};

describe('PayoutBankDetailsForm', () => {
  it('keeps account numbers numeric and displays the resolved account name', () => {
    const onAccountNumberChange = vi.fn();

    render(
      <PayoutBankDetailsForm
        accountName="Baci Store Ltd"
        accountNumber=""
        colors={colors}
        isVerifying={false}
        onAccountNumberChange={onAccountNumberChange}
        onOpenBankPicker={vi.fn()}
        selectedBank={null}
        shadows={{}}
        verifyError={null}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('0123456789'), {
      target: { value: '01ab234' },
    });

    expect(onAccountNumberChange).toHaveBeenCalledWith('01234');
    expect(screen.getByText('Baci Store Ltd')).toBeInTheDocument();
  });
});
