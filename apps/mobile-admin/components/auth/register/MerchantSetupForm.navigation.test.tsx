import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authUser: {
    id: 'user-1',
    email: 'ada@example.com',
    user_metadata: { first_name: 'Ada', last_name: 'Lovelace' },
  } as {
    id: string;
    email: string;
    user_metadata: Record<string, unknown>;
  },
}));

vi.mock('react-native', async () => {
  return {
    Alert: { alert: vi.fn() },
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
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
    Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    TextInput: ({
      accessibilityLabel,
      onChangeText,
      value,
    }: {
      accessibilityLabel?: string;
      onChangeText?: (value: string) => void;
      value?: string;
    }) => (
      <input
        aria-label={accessibilityLabel}
        onChange={(event) => onChangeText?.(event.target.value)}
        value={value}
      />
    ),
    View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  };
});
vi.mock('expo-router', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock('@react-native-vector-icons/ionicons', () => ({ default: () => null }));
vi.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock('@/components/ui/CountryPickerModal', () => ({
  CountryPickerModal: () => null,
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: mocks.authUser, signOut: vi.fn() }),
}));
vi.mock('@/hooks/useMerchantProvisioning', () => ({
  useMerchantProvisioning: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      border: '#ddd',
      error: '#c00',
      inputBg: '#fff',
      primary: '#111',
      success: '#090',
      text: '#111',
      textMuted: '#666',
      textOnPrimary: '#fff',
      textSecondary: '#555',
    },
  }),
}));
vi.mock('./PersonNameFields', () => ({
  PersonNameFields: ({
    firstName,
    lastName,
    onFirstNameChange,
  }: {
    firstName: string;
    lastName: string;
    onFirstNameChange: (value: string) => void;
  }) => (
    <>
      <input
        aria-label="First Name"
        onChange={(event) => onFirstNameChange(event.target.value)}
        value={firstName}
      />
      <input aria-label="Last Name" readOnly={true} value={lastName} />
    </>
  ),
}));
vi.mock('./RegisterBusinessStep', () => ({
  RegisterBusinessStep: ({ onBack }: { onBack: () => void }) => (
    <>
      <button aria-label="Back to owner details" onClick={onBack} type="button">
        Edit owner details
      </button>
      <input aria-label="Business Name" />
    </>
  ),
}));

import { MerchantSetupForm } from './MerchantSetupForm';

describe('MerchantSetupForm step navigation', () => {
  beforeEach(() => {
    mocks.authUser.user_metadata = {
      first_name: 'Ada',
      last_name: 'Lovelace',
    };
  });

  it('requires the owner and country step even when saved names are complete', () => {
    render(<MerchantSetupForm />);

    expect(screen.queryByLabelText('Business Name')).not.toBeInTheDocument();
    expect(screen.getByLabelText('First Name')).toHaveValue('Ada');
    fireEvent.change(screen.getByLabelText('First Name'), {
      target: { value: 'Augusta' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Continue to business info' })
    );
    expect(screen.queryByText('Country / Region')).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Back to owner details' })
    );
    expect(screen.getByLabelText('First Name')).toHaveValue('Augusta');
  });

  it('starts incomplete social identities on owner details', () => {
    mocks.authUser.user_metadata = {};
    render(<MerchantSetupForm />);

    expect(screen.getByLabelText('First Name')).toBeInTheDocument();
    expect(screen.queryByLabelText('Business Name')).not.toBeInTheDocument();
  });
});
