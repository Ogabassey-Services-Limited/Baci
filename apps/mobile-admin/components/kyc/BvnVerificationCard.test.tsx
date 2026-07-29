import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

type MutationOptions = {
  onError: (error: unknown) => void;
  onSuccess: (data: { verified: boolean }) => Promise<void>;
};

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  options: null as MutationOptions | null,
  showBvnVerificationError: vi.fn(),
}));
vi.mock('@tanstack/react-query', () => ({
  useMutation: (options: MutationOptions) => {
    mocks.options = options;
    return { isPending: false, mutate: vi.fn() };
  },
}));
vi.mock('@/lib/api-client', () => ({ apiClient: vi.fn() }));
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
vi.mock('./BvnMobileNumberField', () => ({ default: () => null }));
vi.mock('./DateOfBirthPicker', () => ({ default: () => null }));
vi.mock('./VerificationStatusBadge', () => ({ default: () => null }));
vi.mock('./bvn-verification-alerts', () => ({
  showBvnVerificationError: mocks.showBvnVerificationError,
}));

import BvnVerificationCard from './BvnVerificationCard';

async function completeVerifiedMutation(): Promise<void> {
  if (!mocks.options) throw new Error('Expected verification mutation options');
  try {
    await mocks.options.onSuccess({ verified: true });
  } catch (error) {
    mocks.options.onError(error);
  }
}

describe('BvnVerificationCard readiness handoff', () => {
  it('awaits refresh before success UI', async () => {
    let release!: () => void;
    const refresh = new Promise<void>((resolve) => {
      release = resolve;
    });
    render(
      <BvnVerificationCard
        dateOfBirth="2000-01-01"
        firstName="A"
        lastName="B"
        mobileNo="08000000000"
        onIdentityChange={vi.fn()}
        onVerified={() => refresh}
        verified={false}
      />
    );
    const done = completeVerifiedMutation();
    await Promise.resolve();
    expect(mocks.alert).not.toHaveBeenCalled();
    release();
    await done;
    expect(mocks.alert).toHaveBeenCalledWith('Success', expect.any(String));
  });

  it('routes a rejected readiness refresh through the existing mutation error handler', async () => {
    render(
      <BvnVerificationCard
        dateOfBirth="2000-01-01"
        firstName="A"
        lastName="B"
        mobileNo="08000000000"
        onIdentityChange={vi.fn()}
        onVerified={() => Promise.reject(new Error('Readiness failed'))}
        verified={false}
      />
    );

    await completeVerifiedMutation();

    expect(mocks.showBvnVerificationError).toHaveBeenCalledWith(
      new Error('Readiness failed')
    );
  });
});
