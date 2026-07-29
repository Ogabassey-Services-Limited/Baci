import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ alert: vi.fn(), options: null as any }));
vi.mock('@tanstack/react-query', () => ({
  useMutation: (options: any) => {
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
  showBvnVerificationError: vi.fn(),
}));

import BvnVerificationCard from './BvnVerificationCard';

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
    const done = mocks.options.onSuccess({ verified: true });
    await Promise.resolve();
    expect(mocks.alert).not.toHaveBeenCalled();
    release();
    await done;
    expect(mocks.alert).toHaveBeenCalledWith('Success', expect.any(String));
  });
});
