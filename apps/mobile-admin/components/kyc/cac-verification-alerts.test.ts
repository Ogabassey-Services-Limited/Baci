import { Alert } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NetworkError } from '@/lib/api-client';
import { showCacVerificationError } from './cac-verification-alerts';

const mocks = vi.hoisted(() => {
  class MockNetworkError extends Error {
    statusCode?: number;

    constructor(message: string, options: { statusCode?: number } = {}) {
      super(message);
      this.statusCode = options.statusCode;
    }
  }

  return { NetworkError: MockNetworkError };
});

vi.mock('react-native', () => ({ Alert: { alert: vi.fn() } }));
vi.mock('@/lib/api-client', () => ({ NetworkError: mocks.NetworkError }));

describe('showCacVerificationError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the rate-limit message for a CAC rate limit response', () => {
    showCacVerificationError(
      new NetworkError('Too many requests', { statusCode: 429 })
    );

    expect(Alert.alert).toHaveBeenCalledWith(
      'Rate Limited',
      'Rate limit exceeded. Please wait a minute and try again.'
    );
  });

  it('keeps the server error message for other CAC failures', () => {
    showCacVerificationError(new Error('Certificate could not be verified'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Error',
      'Certificate could not be verified'
    );
  });
});
