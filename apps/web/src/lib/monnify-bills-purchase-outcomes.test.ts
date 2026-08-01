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

import { purchaseBill } from './monnify-bills';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Monnify bill purchase outcomes', () => {
  it('returns successful PurchaseResult', async () => {
    const mockResponse = {
      requestSuccessful: true,
      responseCode: '0',
      responseMessage: 'Transaction Completed Successfully',
      responseBody: {
        transactionReference: 'MON-TX-123',
        paymentReference: 'BACI-REF-123',
        status: 'PAID',
        token: 'TOKEN-1234',
      },
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse),
    });
    global.fetch = fetchSpy;

    const result = await purchaseBill(
      'IKEDC',
      'IKEDC-PREPAID',
      '12345678',
      2000,
      'JANE DOE',
      'BACI-REF-123',
      '08012345678',
      'VAL-123'
    );

    expect(result).toEqual({
      success: true,
      reference: 'BACI-REF-123',
      transactionId: 'MON-TX-123',
      pin: 'TOKEN-1234',
      message: 'Transaction Completed Successfully',
      status: 'successful',
      amount: 2000,
    });
    expect(
      JSON.parse(String((fetchSpy.mock.calls[0][1] as RequestInit).body))
    ).toMatchObject({
      amount: 2000,
      vendAmount: 2000,
      productCode: 'IKEDC-PREPAID',
      customerId: '12345678',
      vendReference: 'BACI-REF-123',
      validationReference: 'VAL-123',
    });
  });

  it('extracts the prepaid token from nested responseBody.metaData.token', async () => {
    // Regression: Monnify returns the electricity token under
    // responseBody.metaData.token (not a flat `token`). Reading the flat
    // field dropped the token on every prepaid electricity vend.
    const mockResponse = {
      requestSuccessful: true,
      responseCode: '0',
      responseMessage: 'success',
      responseBody: {
        transactionReference: 'MFBP260625173742882d',
        vendReference: 'MFBP-MDR-43901766923-260625173742f9cb',
        vendStatus: 'SUCCESS',
        metaData: { token: '3772-0340-4164-5060-0336', unit: '4.5' },
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse),
    });

    const result = await purchaseBill(
      'biller-ekedc-pre',
      'product-ekedc-pre',
      '43901766923',
      1000,
      'JANE DOE',
      'BACI-REF-123',
      '08012345678',
      'VAL-123'
    );

    expect(result.status).toBe('successful');
    expect(result.pin).toBe('3772-0340-4164-5060-0336');
    expect(result.units).toBe('4.5');
    // Monnify resolves requery by its own vendReference, not transactionRef.
    expect(result.providerVendReference).toBe(
      'MFBP-MDR-43901766923-260625173742f9cb'
    );
  });

  it('honors vendStatus when status is missing', async () => {
    const mockResponse = {
      requestSuccessful: true,
      responseCode: '0',
      responseMessage: 'Completed',
      responseBody: {
        transactionReference: 'MON-TX-123',
        paymentReference: 'BACI-REF-123',
        vendStatus: 'SUCCESS',
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse),
    });

    const result = await purchaseBill(
      'IKEDC',
      'IKEDC-PREPAID',
      '12345678',
      2000,
      'JANE DOE',
      'BACI-REF-123',
      '08012345678',
      'VAL-123'
    );
    expect(result.status).toBe('successful');
    expect(result.success).toBe(true);
  });

  it('falls back to payment status when vendStatus is blank', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        requestSuccessful: true,
        responseCode: '0',
        responseMessage: 'Completed',
        responseBody: {
          transactionReference: 'MON-TX-123',
          paymentReference: 'BACI-REF-123',
          status: 'PAID',
          vendStatus: '   ',
          token: 'TOKEN-1234',
        },
      }),
    });

    const result = await purchaseBill(
      'IKEDC',
      'IKEDC-PREPAID',
      '12345678',
      2000,
      'JANE DOE',
      'BACI-REF-123',
      '08012345678',
      'VAL-123'
    );

    expect(result.status).toBe('successful');
    expect(result.success).toBe(true);
    expect(result.pin).toBe('TOKEN-1234');
  });

  it('stays pending when payment status is success but vendStatus is in progress', async () => {
    // Regression: prepaid electricity where Monnify charged the customer
    // (status PAID) but the token vend is still IN_PROGRESS. Reading the
    // payment status finalized the bill as "successful" with no token; the
    // delivery status must govern so it stays pending and the token is
    // resolved (and the customer notified) once the vend completes.
    const mockResponse = {
      requestSuccessful: true,
      responseCode: '0',
      responseMessage: 'Processing',
      responseBody: {
        transactionReference: 'MON-TX-123',
        // A real pending vend carries the vendReference used to requery it.
        vendReference: 'MFBP-MDR-12345678-260625154352b0b9',
        paymentReference: 'BACI-REF-123',
        status: 'PAID',
        vendStatus: 'IN_PROGRESS',
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockResponse),
    });

    const result = await purchaseBill(
      'IKEDC',
      'IKEDC-PREPAID',
      '12345678',
      2000,
      'JANE DOE',
      'BACI-REF-123',
      '08012345678',
      'VAL-123'
    );

    expect(result.status).toBe('pending');
    expect(result.success).toBe(true);
    expect(result.providerVendReference).toBe(
      'MFBP-MDR-12345678-260625154352b0b9'
    );
    expect(result.pin).toBeUndefined();
  });
});
