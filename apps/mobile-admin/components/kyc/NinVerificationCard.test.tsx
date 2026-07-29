import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ alert: vi.fn(), options: null as any }));
vi.mock('@tanstack/react-query', () => ({
  useMutation: (options: any) => {
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

describe('NinVerificationCard readiness handoff', () => {
  it('awaits refresh before the verified success UI and routes refresh rejection through mutation error', async () => {
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
    const completion = mocks.options.onSuccess({ verified: true });
    await Promise.resolve();
    expect(events).toEqual(['refresh']);
    expect(mocks.alert).not.toHaveBeenCalled();
    release();
    await completion;
    expect(mocks.alert).toHaveBeenCalledWith('Success', expect.any(String));
    await expect(
      mocks.options.onSuccess({
        verified: true,
        onVerified: () => Promise.reject(new Error('refresh')),
      })
    ).resolves.toBeUndefined();
  });
});
