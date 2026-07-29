import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ options: [] as any[] }));
vi.mock('@tanstack/react-query', () => ({
  useMutation: (options: any) => {
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
  Alert: { alert: vi.fn() },
  Pressable: () => null,
  Text: () => null,
  View: () => null,
  StyleSheet: { create: (value: unknown) => value },
}));
vi.mock('./CacSearchStep', () => ({ default: () => null }));
vi.mock('./CacUploadStep', () => ({ default: () => null }));
vi.mock('./CacResultStep', () => ({ default: () => null }));
vi.mock('./VerificationStatusBadge', () => ({ default: () => null }));
vi.mock('./cac-certificate-picker', () => ({
  chooseCertificateSource: vi.fn(),
  pickCertificateFromFiles: vi.fn(),
  pickCertificateFromGallery: vi.fn(),
}));

import CacVerificationCard from './CacVerificationCard';

describe('CacVerificationCard readiness handoff', () => {
  it('awaits refresh before showing the verified result', async () => {
    let release!: () => void;
    const refresh = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { queryByText } = render(
      <CacVerificationCard onVerified={() => refresh} verified={false} />
    );
    const done = mocks.options[1].onSuccess({ verified: true });
    await Promise.resolve();
    expect(queryByText(/verified/i)).toBeNull();
    release();
    await done;
  });
});
