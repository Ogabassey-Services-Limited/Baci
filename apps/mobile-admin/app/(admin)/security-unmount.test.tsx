import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
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
    data: { currentLevel: 'aal1' },
    error: null,
  });
});

describe('SecurityScreen unmount safety', () => {
  it('does not alert after an enrollment error resolves off-screen', async () => {
    let resolveEnrollment: (value: unknown) => void = () => undefined;
    mocks.enroll.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveEnrollment = resolve;
        })
    );
    const { unmount } = render(<SecurityScreen />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Add backup authenticator' })
    );
    unmount();
    await act(async () => {
      resolveEnrollment({ data: null, error: { message: 'enroll failed' } });
    });

    expect(mocks.alert).not.toHaveBeenCalled();
  });

  it('does not alert after a restart error resolves off-screen', async () => {
    mocks.listFactors.mockResolvedValue({
      data: {
        all: [
          { id: 'factor-1', factor_type: 'totp', status: 'verified' },
          {
            id: 'pending-factor',
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
    const { unmount } = render(<SecurityScreen />);

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Restart backup authenticator setup',
      })
    );
    unmount();
    await act(async () => {
      resolveUnenroll({ data: null, error: { message: 'restart failed' } });
    });

    expect(mocks.alert).not.toHaveBeenCalled();
  });

  it('does not alert after a verification error resolves off-screen', async () => {
    let resolveVerification: (value: unknown) => void = () => undefined;
    mocks.challengeAndVerify.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveVerification = resolve;
        })
    );
    const { unmount } = render(<SecurityScreen />);

    fireEvent.change(await screen.findByLabelText('Authenticator code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
    unmount();
    await act(async () => {
      resolveVerification({
        data: null,
        error: { message: 'verification failed' },
      });
    });

    expect(mocks.alert).not.toHaveBeenCalled();
  });
});
