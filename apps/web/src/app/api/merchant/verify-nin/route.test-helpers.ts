import { NextRequest } from 'next/server';
import { vi } from 'vitest';

export const validNinBody = {
  nin: '12345678901',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1990-01-15',
  merchantId: '11111111-1111-4111-8111-111111111111',
};

export function makeRpcMock(error: unknown = null) {
  return vi.fn().mockResolvedValue({ error });
}

export function makeSupabaseMock(rpcError: unknown = null, country = 'NG') {
  const merchantMaybeSingle = vi.fn().mockResolvedValue({
    data: { country },
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
    rpc: makeRpcMock(rpcError),
  };
}

export function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/merchant/verify-nin', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

export function makeNinResponse(firstName: string, lastName: string) {
  return {
    requestSuccessful: true,
    responseBody: {
      nin: '12345678901',
      firstName,
      lastName,
      middleName: '',
      dateOfBirth: '1990-01-15',
      gender: 'M',
      mobileNumber: '08012345678',
    },
  };
}
