import { Alert } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NetworkError } from '@/lib/api-client';
import { showBvnVerificationError } from './bvn-verification-alerts';

const mocks = vi.hoisted(() => {
  class MockNetworkError extends Error {
    isOffline = false;
    isTimeout = false;
    statusCode: number;

    constructor(message: string, options: { statusCode?: number } = {}) {
      super(message);
      this.statusCode = options.statusCode ?? 0;
    }
  }

  return { NetworkError: MockNetworkError };
});

vi.mock('react-native', () => ({
  Alert: { alert: vi.fn() },
}));

vi.mock('@/lib/api-client', () => ({
  NetworkError: mocks.NetworkError,
}));

describe('showBvnVerificationError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows specific rate limit and provider configuration messages', () => {
    showBvnVerificationError(
      new NetworkError('Too many requests', { statusCode: 429 })
    );
    showBvnVerificationError(
      new NetworkError('BVN verification is not configured', { statusCode: 503 })
    );

    expect(Alert.alert).toHaveBeenNthCalledWith(
      1,
      'Rate Limited',
      'Rate limit exceeded. Please wait a minute and try again.'
    );
    expect(Alert.alert).toHaveBeenNthCalledWith(
      2,
      'BVN Verification Unavailable',
      expect.stringContaining('BVN verification is not configured')
    );
  });

  it('falls back for offline and unknown errors', () => {
    showBvnVerificationError(new Error('offline'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Verification Error',
      'Unable to verify BVN. Please check your connection and try again.'
    );
  });
});
