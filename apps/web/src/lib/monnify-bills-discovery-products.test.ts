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

import {
  getBillerCategories,
  getBillerProducts,
  getCachedBillerProducts,
} from './monnify-bills';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Monnify bill discovery: products and failures', () => {
  it('getBillerProducts returns unwrapped products list', async () => {
    const mockEnvelope = {
      requestSuccessful: true,
      responseCode: '0',
      responseMessage: 'success',
      responseBody: [
        {
          productCode: 'IKEDC-PREPAID',
          name: 'Prepaid',
          billerCode: 'IKEDC',
          fee: '100',
          amount: '0',
          isAmountFixed: 'false',
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockEnvelope),
    });

    const result = await getBillerProducts('IKEDC');
    expect(result).toEqual([
      {
        productCode: 'IKEDC-PREPAID',
        name: 'Prepaid',
        billerCode: 'IKEDC',
        fee: 100,
        amount: 0,
        isAmountFixed: false,
        categoryCode: undefined,
        maxAmount: null,
        minAmount: null,
      },
    ]);
  });

  it('getBillerProducts normalizes current Monnify product responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        requestSuccessful: true,
        responseCode: '0',
        responseMessage: 'success',
        responseBody: {
          content: [
            {
              code: '13',
              name: 'MTN Mobile Top up',
              category: { code: 'AIRTIME', name: 'AIRTIME' },
              biller: { code: 'MTN', name: 'MTN' },
              minAmount: 100,
              maxAmount: null,
              price: null,
              priceType: 'OPEN',
            },
          ],
        },
      }),
    });

    const result = await getBillerProducts('MTN');
    expect(result).toEqual([
      {
        productCode: '13',
        name: 'MTN Mobile Top up',
        billerCode: 'MTN',
        fee: null,
        amount: null,
        isAmountFixed: false,
        categoryCode: 'AIRTIME',
        maxAmount: null,
        minAmount: 100,
      },
    ]);
  });

  it('getCachedBillerProducts delegates cached product discovery by biller code', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        requestSuccessful: true,
        responseCode: '0',
        responseMessage: 'success',
        responseBody: {
          content: [
            {
              code: '13',
              name: 'MTN Mobile Top up',
              category: { code: 'AIRTIME', name: 'AIRTIME' },
              biller: { code: 'MTN', name: 'MTN' },
              minAmount: 100,
              maxAmount: null,
              price: null,
              priceType: 'OPEN',
            },
          ],
        },
      }),
    });

    const result = await getCachedBillerProducts('MTN');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://sandbox.monnify.com/api/v1/vas/bills-payment/biller-products?biller_code=MTN',
      expect.objectContaining({ method: 'GET' })
    );
    expect(result).toEqual([
      expect.objectContaining({
        billerCode: 'MTN',
        productCode: '13',
      }),
    ]);
    expect(mockCacheLife).toHaveBeenCalledWith({
      stale: 60,
      revalidate: 300,
      expire: 3600,
    });
    expect(mockCacheTag).toHaveBeenCalledWith(
      'monnify-discovery',
      'monnify-biller-products-MTN'
    );
  });

  it('removes caller abort listeners after discovery requests settle', async () => {
    const controller = new AbortController();
    const addListener = vi.spyOn(controller.signal, 'addEventListener');
    const removeListener = vi.spyOn(controller.signal, 'removeEventListener');
    const mockEnvelope = {
      requestSuccessful: true,
      responseCode: '0',
      responseMessage: 'success',
      responseBody: [],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockEnvelope),
    });

    await getBillerProducts('IKEDC', { signal: controller.signal });

    expect(addListener).toHaveBeenCalledWith('abort', expect.any(Function), {
      once: true,
    });
    expect(removeListener).toHaveBeenCalledWith(
      'abort',
      addListener.mock.calls[0]?.[1]
    );
  });

  it('throws on HTTP OK Monnify discovery business failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        requestSuccessful: true,
        responseCode: '1',
        responseMessage: 'Category unavailable',
        responseBody: [],
      }),
    });

    await expect(getBillerCategories()).rejects.toThrow('Category unavailable');
  });

  it('rejects malformed Monnify product pricing instead of defaulting to zero', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        requestSuccessful: true,
        responseCode: '0',
        responseMessage: 'success',
        responseBody: [
          {
            productCode: 'IKEDC-PREPAID',
            name: 'Prepaid',
            billerCode: 'IKEDC',
            fee: 'not-a-number',
            amount: 0,
            isAmountFixed: false,
          },
        ],
      }),
    });

    await expect(getBillerProducts('IKEDC')).rejects.toThrow();
  });

  it('propagates HTTP and network errors on discovery helpers', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    await expect(getBillerCategories()).rejects.toThrow('Monnify server error');
  });

  it('keeps HTTP 5xx response body details out of discovery helper messages', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: vi.fn().mockResolvedValue(
        JSON.stringify({
          responseMessage: 'Gateway failed for request 1234567',
        })
      ),
    });

    await expect(getBillerCategories()).rejects.toThrow(
      'Monnify server error: 500 Internal Server Error'
    );
    await expect(getBillerCategories()).rejects.not.toThrow(
      'Gateway failed for request'
    );
  });
});
