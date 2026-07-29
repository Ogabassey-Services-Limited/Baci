import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type MutationOptions = {
  onError: (error: unknown) => void;
  onSuccess: (data: { verified: boolean }) => Promise<void>;
};

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  options: null as MutationOptions | null,
}));
vi.mock('@tanstack/react-query', () => ({
  useMutation: (options: MutationOptions) => {
    mocks.options = options;
    return { isPending: false, mutate: vi.fn() };
  },
}));
vi.mock('@/lib/api-client', () => ({
  apiClient: vi.fn(),
  NetworkError: class NetworkError extends Error {},
}));
vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ colors: {}, shadows: {} }),
}));
vi.mock('@react-native-vector-icons/ionicons', () => ({ default: () => null }));
vi.mock('react-native', () => ({
  ActivityIndicator: () => null,
  Alert: { alert: mocks.alert },
  Pressable: () => null,
  Text: () => null,
  TextInput: () => null,
  View: () => null,
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('./DateOfBirthPicker', () => ({ default: () => null }));
vi.mock('./VerificationStatusBadge', () => ({ default: () => null }));

import NinVerificationCard from './NinVerificationCard';

async function completeVerifiedMutation(): Promise<void> {
  if (!mocks.options) throw new Error('Expected verification mutation options');
  try {
    await mocks.options.onSuccess({ verified: true });
  } catch (error) {
    mocks.options.onError(error);
  }
}

describe('NinVerificationCard readiness handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.options = null;
  });

  it('awaits the readiness refresh before showing verified success', async () => {
    const events: string[] = [];
    let release!: () => void;
    const refresh = new Promise<void>((resolve) => {
      release = resolve;
    });
    render(
      <NinVerificationCard
        dateOfBirth="2000-01-01"
        firstName="A"
        lastName="B"
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
    expect(mocks.alert).toHaveBeenCalledWith('Success', expect.any(String));
  });

  it('preserves verified success when the readiness refresh rejects', async () => {
    render(
      <NinVerificationCard
        dateOfBirth="2000-01-01"
        firstName="A"
        lastName="B"
        onIdentityChange={vi.fn()}
        onVerified={() => Promise.reject(new Error('Readiness failed'))}
        verified={false}
      />
    );

    await completeVerifiedMutation();

    expect(mocks.alert).toHaveBeenCalledWith('Success', expect.any(String));
    expect(mocks.alert).not.toHaveBeenCalledWith(
      'Verification Error',
      expect.any(String)
    );
  });
});
