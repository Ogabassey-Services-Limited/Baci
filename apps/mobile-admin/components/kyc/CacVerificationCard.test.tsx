import { act, fireEvent, render } from '@testing-library/react';
import type React from 'react';
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
    return { isPending: false, mutate: vi.fn(), data: undefined };
  },
}));
vi.mock('@/lib/api-client', () => ({
  apiClient: vi.fn(),
  apiFormData: vi.fn(),
  NetworkError: class NetworkError extends Error {},
}));
vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({ colors: {}, shadows: {} }),
}));
vi.mock('@react-native-vector-icons/ionicons', () => ({ default: () => null }));
vi.mock('react-native', () => ({
  Alert: { alert: mocks.alert },
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: React.ReactNode;
    onPress?: () => void;
  }) => (
    <button aria-label={accessibilityLabel} onClick={onPress} type="button">
      {children}
    </button>
  ),
  Text: ({ children }: { children?: React.ReactNode }) => (
    <span>{children}</span>
  ),
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('./CacSearchStep', () => ({ default: () => null }));
vi.mock('./CacUploadStep', () => ({ default: () => null }));
vi.mock('./CacResultStep', () => ({
  default: ({ verified }: { verified: boolean }) =>
    verified ? <span>Verified result</span> : <span>Unverified result</span>,
}));
vi.mock('./VerificationStatusBadge', () => ({ default: () => null }));
vi.mock('./cac-certificate-picker', () => ({
  chooseCertificateSource: vi.fn(),
  pickCertificateFromFiles: vi.fn(),
  pickCertificateFromGallery: vi.fn(),
}));

import CacVerificationCard from './CacVerificationCard';

async function completeVerifiedMutation(): Promise<void> {
  const uploadMutation = mocks.options.at(-1);
  if (!uploadMutation) throw new Error('Expected CAC upload mutation options');
  try {
    await uploadMutation.onSuccess({ verified: true });
  } catch (error) {
    uploadMutation.onError(error);
  }
}

describe('CacVerificationCard readiness handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.options.length = 0;
  });

  it('awaits refresh before showing the verified result', async () => {
    let release!: () => void;
    const refresh = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { getByRole, queryByText } = render(
      <CacVerificationCard onVerified={() => refresh} verified={false} />
    );
    fireEvent.click(
      getByRole('button', { name: 'Toggle CAC Verification section' })
    );
    const done = completeVerifiedMutation();
    await Promise.resolve();
    expect(queryByText(/verified/i)).toBeNull();
    await act(async () => {
      release();
      await done;
    });
    expect(queryByText('Verified result')).not.toBeNull();
  });

  it('preserves the verified result when the readiness refresh rejects', async () => {
    const { getByRole, queryByText } = render(
      <CacVerificationCard
        onVerified={() => Promise.reject(new Error('Readiness failed'))}
        verified={false}
      />
    );
    fireEvent.click(
      getByRole('button', { name: 'Toggle CAC Verification section' })
    );

    await act(completeVerifiedMutation);

    expect(queryByText('Verified result')).not.toBeNull();
    expect(mocks.alert).not.toHaveBeenCalledWith('Error', expect.any(String));
  });
});
