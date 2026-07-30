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

describe('SecurityScreen', () => {
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

  it('enrolls and verifies a TOTP factor before sensitive settings changes', async () => {
    render(<SecurityScreen />);

    const setupButton = await screen.findByRole('button', {
      name: 'Set up authenticator',
    });
    fireEvent.click(setupButton);

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
    const backupButton = screen.getByRole('button', {
      name: 'Add backup authenticator',
    });
    fireEvent.click(backupButton);

    await waitFor(() => expect(mocks.enroll).toHaveBeenCalledTimes(1));
  });

  it('restarts an interrupted backup before allowing another enrollment', async () => {
    mocks.listFactors.mockResolvedValue({
      data: {
        all: [
          {
            id: 'primary-factor',
            factor_type: 'totp',
            status: 'verified',
          },
          {
            id: 'interrupted-backup',
            factor_type: 'totp',
            status: 'unverified',
          },
        ],
        totp: [{ id: 'primary-factor', status: 'verified' }],
      },
      error: null,
    });

    render(<SecurityScreen />);

    const restartButton = await screen.findByRole('button', {
      name: 'Restart backup authenticator setup',
    });
    expect(
      screen.queryByRole('button', { name: 'Add backup authenticator' })
    ).not.toBeInTheDocument();
    fireEvent.click(restartButton);

    await waitFor(() => {
      expect(mocks.unenroll).toHaveBeenCalledWith({
        factorId: 'interrupted-backup',
      });
      expect(mocks.enroll).toHaveBeenCalledTimes(1);
    });
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

  it('resumes or restarts an unverified factor after reload', async () => {
    mocks.listFactors.mockResolvedValue({
      data: {
        all: [
          {
            id: 'pending-factor',
            factor_type: 'totp',
            status: 'unverified',
          },
        ],
        totp: [],
      },
      error: null,
    });

    render(<SecurityScreen />);

    const restartButton = await screen.findByRole('button', {
      name: 'Restart authenticator setup',
    });
    expect(
      screen.getByText('Enter a code to verify this session')
    ).toBeInTheDocument();
    fireEvent.click(restartButton);

    await waitFor(() => {
      expect(mocks.unenroll).toHaveBeenCalledWith({
        factorId: 'pending-factor',
      });
      expect(mocks.enroll).toHaveBeenCalledTimes(1);
    });
  });

  it('shows a recoverable error when factor loading fails', async () => {
    mocks.listFactors.mockResolvedValue({
      data: { all: [], totp: [] },
      error: { message: 'factor lookup failed' },
    });

    render(<SecurityScreen />);

    expect(
      await screen.findByRole('button', { name: 'Set up authenticator' })
    ).toBeInTheDocument();
    expect(mocks.alert).toHaveBeenCalledWith(
      'Security Error',
      'factor lookup failed'
    );
  });

  it('keeps enrollment retryable when enrollment fails', async () => {
    mocks.enroll.mockResolvedValue({
      data: null,
      error: { message: 'enrollment failed' },
    });
    render(<SecurityScreen />);

    const setupButton = await screen.findByRole('button', {
      name: 'Set up authenticator',
    });
    fireEvent.click(setupButton);

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
