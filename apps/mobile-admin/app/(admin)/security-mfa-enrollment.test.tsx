import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SecurityScreen from './security';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  challengeAndVerify: vi.fn(),
  enroll: vi.fn(),
  getAuthenticatorAssuranceLevel: vi.fn(),
  listFactors: vi.fn(),
  setStringAsync: vi.fn(),
  unenroll: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      mfa: {
        challengeAndVerify: mocks.challengeAndVerify,
        enroll: mocks.enroll,
        getAuthenticatorAssuranceLevel: mocks.getAuthenticatorAssuranceLevel,
        listFactors: mocks.listFactors,
        unenroll: mocks.unenroll,
      },
    },
  },
}));

vi.mock('expo-clipboard', () => ({ setStringAsync: mocks.setStringAsync }));

vi.mock('expo-router', async () => {
  const React = await import('react');
  return { Stack: { Screen: () => React.createElement('div') } };
});

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#ddd',
      card: '#fff',
      primary: '#900',
      success: '#090',
      text: '#111',
      textSecondary: '#555',
    },
  }),
}));

vi.mock('@/components/ui/AppFormScreen', () => ({
  AppFormScreen: ({ children }: { children?: ReactNode }) => (
    <main>{children}</main>
  ),
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <output aria-label="loading" />,
  Alert: { alert: mocks.alert },
  Pressable: ({
    accessibilityLabel,
    children,
    disabled,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    disabled?: boolean;
    onPress?: () => void;
  }) => (
    <button
      aria-label={accessibilityLabel}
      disabled={disabled}
      onClick={onPress}
      type="button"
    >
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
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listFactors.mockResolvedValue({
    data: { all: [], totp: [] },
    error: null,
  });
  mocks.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: 'aal1' },
    error: null,
  });
  mocks.enroll.mockResolvedValue({
    data: { id: 'factor-1', totp: { secret: 'SECRET123' } },
    error: null,
  });
  mocks.challengeAndVerify.mockResolvedValue({ data: {}, error: null });
  mocks.unenroll.mockResolvedValue({ data: {}, error: null });
});

describe('SecurityScreen MFA enrollment', () => {
  it('enrolls and verifies a TOTP factor before sensitive settings changes', async () => {
    render(<SecurityScreen />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Set up authenticator' })
    );

    expect(await screen.findByText('SECRET123')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Authenticator code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));

    await waitFor(() => {
      expect(mocks.challengeAndVerify).toHaveBeenCalledWith({
        code: '123456',
        factorId: 'factor-1',
      });
    });
  });

  it('keeps enrollment retryable when enrollment fails', async () => {
    mocks.enroll.mockResolvedValue({
      data: null,
      error: { message: 'enrollment failed' },
    });
    render(<SecurityScreen />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Set up authenticator' })
    );

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith(
        'Could not enable 2FA',
        'enrollment failed'
      );
    });
    expect(
      screen.getByRole('button', { name: 'Set up authenticator' })
    ).toBeInTheDocument();
  });

  it('keeps verification retryable when challenge verification fails', async () => {
    mocks.challengeAndVerify.mockResolvedValue({
      data: null,
      error: { message: 'invalid code' },
    });
    render(<SecurityScreen />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Set up authenticator' })
    );
    fireEvent.change(await screen.findByLabelText('Authenticator code'), {
      target: { value: '123456' },
    });
    const verifyButton = screen.getByRole('button', { name: 'Verify code' });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith(
        'Verification failed',
        'invalid code'
      );
    });
    expect(verifyButton).toBeInTheDocument();
  });
});
