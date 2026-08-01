import '@testing-library/jest-dom/vitest';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
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
    data: {
      all: [{ id: 'factor-1', factor_type: 'totp', status: 'verified' }],
      totp: [{ id: 'factor-1', status: 'verified' }],
    },
    error: null,
  });
  mocks.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel: 'aal2' },
    error: null,
  });
  mocks.enroll.mockResolvedValue({
    data: { id: 'backup-factor', totp: { secret: 'SECRET123' } },
    error: null,
  });
  mocks.challengeAndVerify.mockResolvedValue({ data: {}, error: null });
  mocks.unenroll.mockResolvedValue({ data: {}, error: null });
});

describe('SecurityScreen enrollment controls', () => {
  it('disables and ignores rapid repeated backup enrollment taps', async () => {
    let resolveEnrollment: (value: unknown) => void = () => undefined;
    mocks.enroll.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveEnrollment = resolve;
        })
    );

    render(<SecurityScreen />);

    const backupButton = await screen.findByRole('button', {
      name: 'Add backup authenticator',
    });
    fireEvent.click(backupButton);
    fireEvent.click(backupButton);

    expect(mocks.enroll).toHaveBeenCalledTimes(1);
    expect(backupButton).toBeDisabled();

    await act(async () => {
      resolveEnrollment({
        data: { id: 'backup-factor', totp: { secret: 'SECRET123' } },
        error: null,
      });
    });
  });

  it('disables and ignores rapid repeated restart enrollment taps', async () => {
    mocks.listFactors.mockResolvedValue({
      data: {
        all: [
          { id: 'factor-1', factor_type: 'totp', status: 'verified' },
          {
            id: 'interrupted-backup',
            factor_type: 'totp',
            status: 'unverified',
          },
        ],
        totp: [{ id: 'factor-1', status: 'verified' }],
      },
      error: null,
    });
    let resolveUnenroll: (value: unknown) => void = () => undefined;
    mocks.unenroll.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUnenroll = resolve;
        })
    );

    render(<SecurityScreen />);

    const restartButton = await screen.findByRole('button', {
      name: 'Restart backup authenticator setup',
    });
    fireEvent.click(restartButton);
    fireEvent.click(restartButton);

    expect(mocks.unenroll).toHaveBeenCalledTimes(1);
    expect(restartButton).toBeDisabled();

    await act(async () => {
      resolveUnenroll({ data: {}, error: null });
    });
  });

  it('releases enrollment controls when enrollment rejects', async () => {
    mocks.enroll.mockRejectedValue(new Error('enrollment rejected'));

    render(<SecurityScreen />);

    const backupButton = await screen.findByRole('button', {
      name: 'Add backup authenticator',
    });
    fireEvent.click(backupButton);

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith(
        'Security Error',
        'enrollment rejected'
      );
    });
    expect(backupButton).not.toBeDisabled();
  });

  it('releases restart controls when unenrollment rejects', async () => {
    mocks.listFactors.mockResolvedValue({
      data: {
        all: [
          { id: 'factor-1', factor_type: 'totp', status: 'verified' },
          {
            id: 'interrupted-backup',
            factor_type: 'totp',
            status: 'unverified',
          },
        ],
        totp: [{ id: 'factor-1', status: 'verified' }],
      },
      error: null,
    });
    mocks.unenroll.mockRejectedValue(new Error('unenrollment rejected'));

    render(<SecurityScreen />);

    const restartButton = await screen.findByRole('button', {
      name: 'Restart backup authenticator setup',
    });
    fireEvent.click(restartButton);

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith(
        'Security Error',
        'unenrollment rejected'
      );
    });
    expect(restartButton).not.toBeDisabled();
  });
});
