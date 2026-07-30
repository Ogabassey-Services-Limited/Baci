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

describe('SecurityScreen factor selection', () => {
  it('offers backup enrollment when a verified factor exists', async () => {
    mocks.listFactors.mockResolvedValue({
      data: {
        all: [{ id: 'factor-2', factor_type: 'totp', status: 'verified' }],
        totp: [{ id: 'factor-2', status: 'verified' }],
      },
      error: null,
    });
    mocks.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal2' },
      error: null,
    });

    render(<SecurityScreen />);

    expect(
      await screen.findByText('2FA enabled and verified')
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Add backup authenticator' })
    );

    await waitFor(() => expect(mocks.enroll).toHaveBeenCalledTimes(1));
  });

  it('verifies a session with the selected backup authenticator', async () => {
    mocks.listFactors.mockResolvedValue({
      data: {
        all: [
          {
            id: 'primary-factor',
            factor_type: 'totp',
            friendly_name: 'Primary authenticator',
            status: 'verified',
          },
          {
            id: 'backup-factor',
            factor_type: 'totp',
            friendly_name: 'Backup authenticator',
            status: 'verified',
          },
        ],
        totp: [
          {
            id: 'primary-factor',
            friendly_name: 'Primary authenticator',
            status: 'verified',
          },
          {
            id: 'backup-factor',
            friendly_name: 'Backup authenticator',
            status: 'verified',
          },
        ],
      },
      error: null,
    });

    render(<SecurityScreen />);

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Use Backup authenticator',
      })
    );
    fireEvent.change(screen.getByLabelText('Authenticator code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));

    await waitFor(() => {
      expect(mocks.challengeAndVerify).toHaveBeenCalledWith({
        code: '123456',
        factorId: 'backup-factor',
      });
    });
  });

  it('refreshes the assurance level after verifying an existing factor', async () => {
    mocks.listFactors.mockResolvedValue({
      data: {
        all: [
          {
            id: 'existing-factor',
            factor_type: 'totp',
            status: 'verified',
          },
        ],
        totp: [{ id: 'existing-factor', status: 'verified' }],
      },
      error: null,
    });
    mocks.getAuthenticatorAssuranceLevel
      .mockResolvedValueOnce({ data: { currentLevel: 'aal1' }, error: null })
      .mockResolvedValueOnce({ data: { currentLevel: 'aal2' }, error: null });

    render(<SecurityScreen />);

    fireEvent.change(await screen.findByLabelText('Authenticator code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));

    await waitFor(() => {
      expect(mocks.getAuthenticatorAssuranceLevel).toHaveBeenCalledTimes(2);
      expect(screen.getByText('2FA enabled and verified')).toBeInTheDocument();
    });
  });

  it('does not report successful verification when the assurance refresh fails', async () => {
    mocks.listFactors.mockResolvedValue({
      data: {
        all: [
          {
            id: 'existing-factor',
            factor_type: 'totp',
            status: 'verified',
          },
        ],
        totp: [{ id: 'existing-factor', status: 'verified' }],
      },
      error: null,
    });
    mocks.getAuthenticatorAssuranceLevel
      .mockResolvedValueOnce({ data: { currentLevel: 'aal1' }, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'assurance refresh failed' },
      });

    render(<SecurityScreen />);

    fireEvent.change(await screen.findByLabelText('Authenticator code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith(
        'Verification incomplete',
        'assurance refresh failed'
      );
    });
    expect(mocks.alert).not.toHaveBeenCalledWith(
      'Two-factor authentication enabled',
      'Your session is verified.'
    );
  });
});
