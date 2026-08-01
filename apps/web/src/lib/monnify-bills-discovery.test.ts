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
  getBillers,
  getCachedBillers,
} from './monnify-bills';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Monnify bill discovery: categories and billers', () => {
  it('getBillerCategories returns unwrapped categories list', async () => {
    const mockEnvelope = {
      requestSuccessful: true,
      responseCode: 0,
      responseMessage: 'success',
      responseBody: [
        { name: 'Utility', description: 'Utility Payments', code: 'UTILITY' },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockEnvelope),
    });

    const result = await getBillerCategories();
    expect(result).toEqual([
      { name: 'Utility', description: 'Utility Payments', code: 'UTILITY' },
    ]);
  });

  it('getBillerCategories unwraps current paginated category responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        requestSuccessful: true,
        responseCode: '0',
        responseMessage: 'success',
        responseBody: {
          content: [{ code: 'AIRTIME', name: 'AIRTIME' }],
          totalElements: 1,
        },
      }),
    });

    const result = await getBillerCategories();
    expect(result).toEqual([{ code: 'AIRTIME', name: 'AIRTIME' }]);
  });

  it('getBillers returns unwrapped billers list', async () => {
    const mockEnvelope = {
      requestSuccessful: true,
      responseCode: '0',
      responseMessage: 'success',
      responseBody: [
        {
          name: 'IKEDC',
          description: 'Ikeja Electric',
          billerCode: 'IKEDC',
          billerCategoryCode: 'UTILITY',
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(mockEnvelope),
    });

    const result = await getBillers('UTILITY');
    expect(result).toEqual([
      {
        name: 'IKEDC',
        description: 'Ikeja Electric',
        billerCode: 'IKEDC',
        billerCategoryCode: 'UTILITY',
        categoryCodes: ['UTILITY'],
      },
    ]);
  });

  it('getBillers normalizes current Monnify biller responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        requestSuccessful: true,
        responseCode: '0',
        responseMessage: 'success',
        responseBody: {
          content: [
            {
              code: 'MTN',
              name: 'MTN',
              categories: [{ code: 'AIRTIME', name: 'AIRTIME' }],
            },
          ],
        },
      }),
    });

    const result = await getBillers('AIRTIME');
    expect(result).toEqual([
      {
        name: 'MTN',
        description: 'MTN',
        billerCode: 'MTN',
        billerCategoryCode: 'AIRTIME',
        categoryCodes: ['AIRTIME'],
      },
    ]);
  });

  it('getBillers rejects current Monnify billers without category references', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        requestSuccessful: true,
        responseCode: '0',
        responseMessage: 'success',
        responseBody: {
          content: [
            {
              code: 'MTN',
              name: 'MTN',
              categories: [],
            },
          ],
        },
      }),
    });

    await expect(getBillers('AIRTIME')).rejects.toThrow(
      'At least one Monnify category is required'
    );
  });

  it('getCachedBillers delegates cached category discovery by category code', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        requestSuccessful: true,
        responseCode: '0',
        responseMessage: 'success',
        responseBody: {
          content: [
            {
              code: 'MTN',
              name: 'MTN',
              categories: [{ code: 'AIRTIME', name: 'AIRTIME' }],
            },
          ],
        },
      }),
    });

    const result = await getCachedBillers('AIRTIME');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://sandbox.monnify.com/api/v1/vas/bills-payment/billers?categoryCode=AIRTIME',
      expect.objectContaining({ method: 'GET' })
    );
    expect(result).toEqual([
      expect.objectContaining({
        billerCode: 'MTN',
        categoryCodes: ['AIRTIME'],
      }),
    ]);
    expect(mockCacheLife).toHaveBeenCalledWith({
      stale: 60,
      revalidate: 300,
      expire: 3600,
    });
    expect(mockCacheTag).toHaveBeenCalledWith(
      'monnify-discovery',
      'monnify-billers-AIRTIME'
    );
  });
});
