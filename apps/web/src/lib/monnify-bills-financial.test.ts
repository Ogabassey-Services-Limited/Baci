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

import { verifyBillCustomer } from './monnify-bills';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Monnify bill customer verification', () => {
  it('returns flat validation details on success', async () => {
    const mockResponse = {
      requestSuccessful: true,
      responseCode: '0',
      responseMessage: 'success',
      responseBody: {
        customerName: 'JANE DOE',
        validationReference: 'VAL-123',
        requireValidationRef: true,
      },
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse),
    });
    global.fetch = fetchSpy;

    const result = await verifyBillCustomer(
      'IKEDC',
      'IKEDC-PREPAID',
      '12345678'
    );
    expect(result).toEqual({
      verified: true,
      customerName: 'JANE DOE',
      validationReference: 'VAL-123',
      requireValidationRef: true,
      message: 'success',
    });
  });

  it('sends only documented Monnify validate-customer fields', async () => {
    const mockResponse = {
      requestSuccessful: true,
      responseCode: '0',
      responseMessage: 'success',
      responseBody: {
        customerName: 'JANE DOE',
        requireValidationRef: false,
      },
    };
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse),
    });
    global.fetch = fetchSpy;

    const result = await verifyBillCustomer(
      'IKEDC',
      'IKEDC-PREPAID',
      '12345678'
    );

    expect(result.verified).toBe(true);
    expect(JSON.parse(fetchSpy.mock.calls[0]?.[1]?.body as string)).toEqual({
      productCode: 'IKEDC-PREPAID',
      customerId: '12345678',
    });
  });

  it('returns nested vendInstruction validation details on success', async () => {
    const mockResponse = {
      requestSuccessful: true,
      responseCode: '0',
      responseMessage: 'success',
      responseBody: {
        customerName: 'JANE DOE',
        vendInstruction: {
          validationReference: 'VAL-NESTED-999',
          requireValidationRef: true,
        },
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse),
    });

    const result = await verifyBillCustomer(
      'IKEDC',
      'IKEDC-PREPAID',
      '12345678'
    );
    expect(result).toEqual({
      verified: true,
      customerName: 'JANE DOE',
      validationReference: 'VAL-NESTED-999',
      requireValidationRef: true,
      message: 'success',
    });
  });

  it('handles verification failure gracefully without throwing', async () => {
    const mockResponse = {
      requestSuccessful: false,
      responseCode: '99',
      responseMessage: 'Invalid meter number',
      responseBody: null,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse),
    });

    const result = await verifyBillCustomer(
      'IKEDC',
      'IKEDC-PREPAID',
      '12345678'
    );
    expect(result.verified).toBe(false);
    expect(result.message).toContain('Invalid meter number');
  });

  it('returns a safe verification failure for HTTP OK non-zero responseCode', async () => {
    const mockResponse = {
      requestSuccessful: true,
      responseCode: '1',
      responseMessage: 'Customer validation failed',
      responseBody: {
        customerName: 'JANE DOE',
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse),
    });

    const result = await verifyBillCustomer(
      'IKEDC',
      'IKEDC-PREPAID',
      '12345678'
    );
    expect(result.verified).toBe(false);
    expect(result.message).toContain('Customer validation failed');
  });

  it('handles verification exceptions gracefully returning safe failure shape', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network disconnected'));

    const result = await verifyBillCustomer(
      'IKEDC',
      'IKEDC-PREPAID',
      '12345678'
    );
    expect(result.verified).toBe(false);
    expect(result.message).toContain('Network disconnected');
  });

  it('does not expose Monnify HTTP body diagnostics in verification responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          responseMessage:
            'Provider wallet 1234567890 cannot validate customer 08012345678',
        })
      ),
    });

    const result = await verifyBillCustomer(
      'IKEDC',
      'IKEDC-PREPAID',
      '12345678'
    );

    expect(result.verified).toBe(false);
    expect(result.message).toBe(
      'Verification could not be completed with Monnify. Please check the details and try again.'
    );
    expect(result.message).not.toContain('1234567890');
    expect(result.message).not.toContain('08012345678');
  });
});
