import type { NextRequest } from 'next/server';
import { vi } from 'vitest';

export const validBvnBody = {
  bvn: '12345678901',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1990-01-15',
  mobileNo: '08012345678',
  merchantId: '11111111-1111-4111-8111-111111111111',
};

export const fullMatchResponse = {
  requestSuccessful: true,
  responseBody: {
    matchStatus: 'FULL_MATCH',
    individualDetails: {
      firstName: 'John',
      lastName: 'Doe',
      middleName: '',
      dateOfBirth: '1990-01-15',
      mobileNo: '08012345678',
    },
  },
};

export const noMatchResponse = {
  requestSuccessful: true,
  responseBody: {
    matchStatus: 'NO_MATCH',
    individualDetails: {
      firstName: 'Jane',
      lastName: 'Smith',
      middleName: '',
      dateOfBirth: '1985-06-20',
      mobileNo: '08099999999',
    },
  },
};

export function makeSupabaseMock(
  rpcError: unknown = null,
  merchantPhone: string | null = '08012345678',
  country = 'NG'
) {
  const merchantMaybeSingle = vi.fn().mockResolvedValue({
    data: { country, phone: merchantPhone },
    error: null,
  });

  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: merchantMaybeSingle,
        })),
      })),
    })),
    merchantMaybeSingle,
    rpc: vi.fn().mockResolvedValue({ error: rpcError }),
  };
}

export function makeRequest(body: unknown): NextRequest {
  return {
    method: 'POST',
    headers: new Headers({ 'Content-Type': 'application/json' }),
    nextUrl: new URL('http://localhost/api/merchant/verify-bvn'),
    json: vi.fn().mockResolvedValue(body),
    cookies: { get: vi.fn() },
  } as unknown as NextRequest;
}
