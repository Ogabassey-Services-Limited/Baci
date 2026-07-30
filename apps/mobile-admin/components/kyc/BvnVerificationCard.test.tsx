import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type MutationOptions = {
  onError: (error: unknown) => void;
  onSuccess: (data: {
    verified: boolean;
    mismatchFields?: string[];
  }) => Promise<void>;
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
vi.mock('react-native', async () => {
  const { createElement } = await import('react');
  return {
    ActivityIndicator: () => null,
    Alert: { alert: mocks.alert },
    Pressable: ({ children }: { children?: ReactNode }) =>
      createElement('button', null, children),
    Text: ({ children }: { children?: ReactNode }) =>
      createElement('span', null, children),
    TextInput: ({ accessibilityLabel }: { accessibilityLabel?: string }) =>
      createElement('input', { 'aria-label': accessibilityLabel }),
    View: ({ children }: { children?: ReactNode }) =>
      createElement('div', null, children),
    StyleSheet: { create: (value: unknown) => value },
  };
});
vi.mock('./BvnMobileNumberField', () => ({ default: () => null }));
vi.mock('./DateOfBirthPicker', () => ({ default: () => null }));
vi.mock('./VerificationStatusBadge', () => ({ default: () => null }));
vi.mock('./bvn-verification-alerts', () => ({
  showBvnVerificationError: mocks.showBvnVerificationError,
}));

import BvnVerificationCard from './BvnVerificationCard';

async function completeMutation(
  verified: boolean,
  mismatchFields?: string[]
): Promise<void> {
  if (!mocks.options) throw new Error('Expected verification mutation options');
  try {
    await mocks.options.onSuccess({ verified, mismatchFields });
  } catch (error) {
    mocks.options.onError(error);
  }
}

describe('BvnVerificationCard readiness handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.options = null;
  });

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
        onMobileNumberChange={vi.fn()}
        onVerified={() => refresh}
        verified={false}
      />
    );
    const done = completeMutation(true);
    await Promise.resolve();
    expect(mocks.alert).not.toHaveBeenCalled();
    release();
    await done;
    expect(mocks.alert).toHaveBeenCalledWith(
      'Success',
      'Your BVN has been verified successfully.'
    );
  });

  it('preserves verified success when the readiness refresh rejects', async () => {
    render(
      <BvnVerificationCard
        dateOfBirth="2000-01-01"
        firstName="A"
        lastName="B"
        mobileNo="08000000000"
        onMobileNumberChange={vi.fn()}
        onVerified={() => Promise.reject(new Error('Readiness failed'))}
        verified={false}
      />
    );

    await completeMutation(true);

    expect(mocks.alert).toHaveBeenCalledWith(
      'Success',
      'Your BVN has been verified successfully. Your setup status will refresh shortly.'
    );
    expect(mocks.showBvnVerificationError).not.toHaveBeenCalled();
  });

  it('refreshes the verified merchant but suppresses stale BVN success UI', async () => {
    const onVerified = vi.fn().mockResolvedValue(undefined);
    render(
      <BvnVerificationCard
        dateOfBirth="2000-01-01"
        firstName="A"
        isActive={() => false}
        lastName="B"
        mobileNo="08000000000"
        onMobileNumberChange={vi.fn()}
        onVerified={onVerified}
        verified={false}
      />
    );

    await completeMutation(true);

    expect(onVerified).toHaveBeenCalledTimes(1);
    expect(mocks.alert).not.toHaveBeenCalled();
  });

  it('reports a failed match without refreshing readiness', async () => {
    const onVerified = vi.fn().mockResolvedValue(undefined);
    render(
      <BvnVerificationCard
        dateOfBirth="2000-01-01"
        firstName="A"
        lastName="B"
        mobileNo="08000000000"
        onMobileNumberChange={vi.fn()}
        onVerified={onVerified}
        verified={false}
      />
    );

    await completeMutation(false);

    expect(mocks.alert).toHaveBeenCalledWith(
      'Verification Failed',
      "The details you provided don't match BVN records."
    );
    expect(onVerified).not.toHaveBeenCalled();
  });

  it('reports an explicit mobile number mismatch returned by the server', async () => {
    render(
      <BvnVerificationCard
        dateOfBirth="2000-01-01"
        firstName="A"
        lastName="B"
        mobileNo="08000000000"
        onMobileNumberChange={vi.fn()}
        onVerified={vi.fn()}
        verified={false}
      />
    );

    await completeMutation(false, ['mobile_number']);

    expect(mocks.alert).toHaveBeenCalledWith(
      'Verification Failed',
      'The mobile number does not match your BVN records.'
    );
  });

  it('folds the BVN form after verification completes', () => {
    render(
      <BvnVerificationCard
        dateOfBirth="2000-01-01"
        firstName="A"
        lastName="B"
        mobileNo="08000000000"
        onMobileNumberChange={vi.fn()}
        onVerified={vi.fn()}
        verified
      />
    );

    expect(screen.queryByLabelText('BVN input')).toBeNull();
    expect(screen.getByText('BVN Verification')).not.toBeNull();
  });
});
