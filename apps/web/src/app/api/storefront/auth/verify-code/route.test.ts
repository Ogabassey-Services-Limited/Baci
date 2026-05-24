import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFrom, mockLoggerError, mockLoggerWarn, mockVerifyOtp } = vi.hoisted(
  () => ({
    mockFrom: vi.fn(),
    mockLoggerError: vi.fn(),
    mockLoggerWarn: vi.fn(),
    mockVerifyOtp: vi.fn(),
  })
);

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      updateUser: vi.fn(),
      verifyOtp: mockVerifyOtp,
    },
    from: mockFrom,
    rpc: vi.fn(),
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
  },
}));

import { POST } from './route';

const merchant = {
  id: 'merchant-1',
  slug: 'ogabassey',
  business_name: 'Ogabassey',
};

function makeRequest(body: Record<string, unknown>) {
  return new Request('https://example.com/api/storefront/auth/verify-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeMerchantQuery(data: unknown) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn().mockResolvedValue({ data, error: null }),
  };

  return chain;
}

describe('POST /api/storefront/auth/verify-code', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue(makeMerchantQuery(merchant));
  });

  it('logs expired customer OTP attempts as warnings while returning the existing 400 response', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { user: null },
      error: { message: 'Token has expired or is invalid' },
    });

    const response = await POST(
      makeRequest({
        email: 'customer@example.com',
        token: '123456',
        merchantSlug: 'ogabassey',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: 'Verification code has expired. Please request a new one.',
    });
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'OTP verification error',
        email: 'cus***@example.com',
      })
    );
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it('keeps unexpected OTP verification failures at error level', async () => {
    mockVerifyOtp.mockResolvedValue({
      data: { user: null },
      error: { message: 'Supabase auth service unavailable' },
    });

    const response = await POST(
      makeRequest({
        email: 'customer@example.com',
        token: '123456',
        merchantSlug: 'ogabassey',
      })
    );

    expect(response.status).toBe(400);
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'OTP verification error',
        email: 'cus***@example.com',
      })
    );
    expect(mockLoggerWarn).not.toHaveBeenCalled();
  });
});
