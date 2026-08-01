import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type MutationOptions = {
  onError: (error: unknown) => void;
  onSuccess: (data: { verified: boolean }) => Promise<void>;
};

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  options: [] as MutationOptions[],
}));
vi.mock('@tanstack/react-query', () => ({
  useMutation: (options: MutationOptions) => {
    mocks.options.push(options);
    return { isPending: false, mutate: vi.fn() };
  },
}));
vi.mock('@/lib/api-client', () => ({
  apiClient: vi.fn(),
  NetworkError: class NetworkError extends Error {},
}));
vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      border: '#334155',
      card: '#111827',
      inputBg: '#0f172a',
      primary: '#3b82f6',
      success: '#22c55e',
      successLight: '#052e16',
      text: '#f8fafc',
      textMuted: '#94a3b8',
      textOnPrimary: '#ffffff',
      textSecondary: '#cbd5e1',
    },
    shadows: {},
  }),
}));
vi.mock('@react-native-vector-icons/ionicons', () => ({ default: () => null }));
vi.mock('react-native', () => ({
  ActivityIndicator: () => <span>loading</span>,
  Alert: { alert: mocks.alert },
  Pressable: ({
    children,
    onPress,
  }: {
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button onClick={() => onPress?.()} type="button">
      {children}
    </button>
  ),
  StyleSheet: { create: (value: unknown) => value },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  TextInput: () => <input />,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
vi.mock('./DateOfBirthPicker', () => ({
  default: () => <input aria-label="Date of birth" />,
}));

import NinVerificationCard from './NinVerificationCard';

async function completeVerifiedMutation(): Promise<void> {
  const options = mocks.options[0];
  if (!options) throw new Error('Expected verification mutation options');
  try {
    await options.onSuccess({ verified: true });
  } catch (error) {
    options.onError(error);
  }
}

describe('NinVerificationCard readiness handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.options = [];
  });

  it('awaits the readiness refresh before showing verified success', async () => {
    const events: string[] = [];
    let release!: () => void;
    const refresh = new Promise<void>((resolve) => {
      release = resolve;
    });
    render(
      <NinVerificationCard
        bvnVerified={false}
        dateOfBirth="2000-01-01"
        firstName="A"
        lastName="B"
        mobileNo="08012345678"
        onIdentityChange={vi.fn()}
        onVerified={() => {
          events.push('refresh');
          return refresh;
        }}
        verified={false}
      />
    );
    const completion = completeVerifiedMutation();
    await Promise.resolve();
    expect(events).toEqual(['refresh']);
    expect(mocks.alert).not.toHaveBeenCalled();
    release();
    await completion;
    expect(mocks.alert).toHaveBeenCalledWith(
      'Success',
      'Your NIN has been verified successfully.'
    );
  });

  it('preserves verified success when the readiness refresh rejects', async () => {
    render(
      <NinVerificationCard
        bvnVerified={false}
        dateOfBirth="2000-01-01"
        firstName="A"
        lastName="B"
        mobileNo="08012345678"
        onIdentityChange={vi.fn()}
        onVerified={() => Promise.reject(new Error('Readiness failed'))}
        verified={false}
      />
    );

    await completeVerifiedMutation();

    expect(mocks.alert).toHaveBeenCalledWith(
      'Success',
      'Your NIN has been verified successfully. Your setup status will refresh shortly.'
    );
    expect(mocks.alert).not.toHaveBeenCalledWith(
      'Verification Error',
      expect.any(String)
    );
  });

  it('refreshes the verified merchant but suppresses stale NIN success UI', async () => {
    const onVerified = vi.fn().mockResolvedValue(undefined);
    render(
      <NinVerificationCard
        bvnVerified={false}
        dateOfBirth="2000-01-01"
        firstName="A"
        lastName="B"
        mobileNo="08012345678"
        isActive={() => false}
        onIdentityChange={vi.fn()}
        onVerified={onVerified}
        verified={false}
      />
    );
    const completion = mocks.options[0];
    if (!completion) throw new Error('Expected verification mutation options');

    await completion.onSuccess({ verified: true });

    expect(onVerified).toHaveBeenCalledTimes(1);
    expect(mocks.alert).not.toHaveBeenCalled();
  });
});
