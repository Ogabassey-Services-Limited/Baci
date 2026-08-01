import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCacheLife, mockCacheTag } = vi.hoisted(() => ({
  mockCacheLife: vi.fn(),
  mockCacheTag: vi.fn(),
}));

vi.mock('next/cache', () => ({
  cacheLife: mockCacheLife,
  cacheTag: mockCacheTag,
}));

vi.mock('@/lib/monnify', () => ({
  getMonnifyToken: vi.fn().mockResolvedValue('mock-token'),
}));

vi.mock('@/lib/monnify-provider-config', () => ({
  getMonnifyBaseUrl: () => 'https://sandbox.monnify.com',
}));

import { sanitizeMonnifyErrorDetail } from './monnify-bills';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sanitizeMonnifyErrorDetail', () => {
  it('preserves six digit sequences and redacts seven digit sequences', () => {
    expect(sanitizeMonnifyErrorDetail('provider code 123456')).toBe(
      'provider code 123456'
    );
    expect(sanitizeMonnifyErrorDetail('provider code 1234567')).toBe(
      'provider code [redacted]'
    );
  });

  it('redacts digit sequences adjacent to letters and underscores', () => {
    expect(sanitizeMonnifyErrorDetail('customer_08012345678 id12345678')).toBe(
      'customer_[redacted] id[redacted]'
    );
  });

  it('truncates long messages to the configured detail cap', () => {
    expect(sanitizeMonnifyErrorDetail('x'.repeat(260))).toHaveLength(240);
  });

  it('drops digit sequences cut by the lookahead bound after redaction', () => {
    const result = sanitizeMonnifyErrorDetail(
      `${'1'.repeat(100)} ${'x'.repeat(198)} 9876543210`
    );

    expect(result.length).toBeLessThanOrEqual(240);
    expect(result).toContain('[redacted]');
    expect(result).not.toContain('9876');
  });
});
