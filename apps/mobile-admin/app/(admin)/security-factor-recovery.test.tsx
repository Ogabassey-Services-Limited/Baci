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

describe('SecurityScreen factor recovery', () => {
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

  it('keeps the verified authenticator challengeable when backup replacement enrollment fails', async () => {
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
    mocks.enroll.mockResolvedValue({
      data: null,
      error: { message: 'replacement enrollment failed' },
    });

    render(<SecurityScreen />);

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Restart backup authenticator setup',
      })
    );

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith(
        'Could not enable 2FA',
        'replacement enrollment failed'
      );
    });

    fireEvent.change(screen.getByLabelText('Authenticator code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));

    await waitFor(() => {
      expect(mocks.challengeAndVerify).toHaveBeenCalledWith({
        code: '123456',
        factorId: 'primary-factor',
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

  it('recovers when initial factor loading rejects', async () => {
    mocks.listFactors.mockRejectedValue(new Error('factor loading rejected'));

    render(<SecurityScreen />);

    expect(
      await screen.findByRole('button', { name: 'Set up authenticator' })
    ).toBeInTheDocument();
    expect(mocks.alert).toHaveBeenCalledWith(
      'Security Error',
      'factor loading rejected'
    );
  });
});
