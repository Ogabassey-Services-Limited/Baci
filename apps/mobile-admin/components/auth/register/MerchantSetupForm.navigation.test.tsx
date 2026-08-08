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
  RegisterBusinessStep: ({ onBack }: { onBack?: () => void }) => (
    <>
      <button aria-label="Back to about you" onClick={onBack} type="button">
        Back to about you
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

  it('starts complete signup identities on business details without repeating owner details', () => {
    render(<MerchantSetupForm />);

    expect(screen.getByLabelText('Business Name')).toBeInTheDocument();
    expect(screen.queryByLabelText('First Name')).not.toBeInTheDocument();
  });

  it('returns to about-you details from business setup', () => {
    render(<MerchantSetupForm />);

    fireEvent.click(screen.getByRole('button', { name: 'Back to about you' }));

    expect(screen.getByLabelText('First Name')).toHaveValue('Ada');
    expect(screen.queryByLabelText('Business Name')).not.toBeInTheDocument();
  });

  it('starts incomplete social identities on owner details', () => {
    mocks.authUser.user_metadata = {};
    render(<MerchantSetupForm />);

    expect(screen.getByLabelText('First Name')).toBeInTheDocument();
    expect(screen.queryByLabelText('Business Name')).not.toBeInTheDocument();
  });
});
