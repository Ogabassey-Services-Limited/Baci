import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----

vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://test.supabase.co',
  getSupabaseAnonKey: () => 'test-anon-key',
  getSupabaseServiceRoleKey: () => 'test-service-role-key',
  getRootDomain: () => 'localhost',
}));

interface Biller {
  billerId: string;
  billerName: string;
  billerType: string;
  categoryId: string;
  categoryName: string;
  billItems?: Array<{
    itemCode: string;
    itemName: string;
    amount: number;
    itemCurrencySymbol: string;
    isAmountFixed: boolean;
    itemFee: number;
  }>;
}

let mockBillers: Biller[] = [];
let mockGetBillersByCategory = vi.fn();
let mockMonnifyGetBillers = vi.fn();
let mockMonnifyGetBillerProducts = vi.fn();

vi.mock('@/lib/kuda-bills', () => ({
  getBillersByCategory: (...args: unknown[]) =>
    mockGetBillersByCategory(...args),
}));

vi.mock('@/lib/monnify-bills', () => ({
  getBillerCategories: vi.fn(),
  getBillers: (...args: unknown[]) => mockMonnifyGetBillers(...args),
  getBillerProducts: (...args: unknown[]) =>
    mockMonnifyGetBillerProducts(...args),
}));

// ---- Helpers ----

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost:3000/api/vtu/billers');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

// ---- Tests ----

describe('GET /api/vtu/billers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBillers = [
      {
        billerId: 'biller-1',
        billerName: 'Ikeja Electric',
        billerType: 'prepaid',
        categoryId: 'cat-1',
        categoryName: 'Electricity',
        billItems: [
          {
            itemCode: 'prepaid',
            itemName: 'Prepaid',
            amount: 0,
            itemCurrencySymbol: 'NGN',
            isAmountFixed: false,
            itemFee: 0,
          },
        ],
      },
      {
        billerId: 'biller-2',
        billerName: 'Eko Electric',
        billerType: 'postpaid',
        categoryId: 'cat-1',
        categoryName: 'Electricity',
      },
    ];
    mockGetBillersByCategory = vi.fn().mockResolvedValue(mockBillers);
    mockMonnifyGetBillers = vi.fn().mockResolvedValue([]);
    mockMonnifyGetBillerProducts = vi.fn().mockResolvedValue([]);
  });

  it('returns billers for valid type (electricity)', async () => {
    const { GET } = await import('./route');

    const request = makeRequest({ type: 'electricity' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    const expected = mockBillers.map((b) => ({
      ...b,
      provider: 'kuda',
      billItems: b.billItems?.map((item) => ({
        ...item,
        provider: 'kuda',
      })),
    }));
    expect(data.billers).toEqual(expected);
    expect(mockGetBillersByCategory).toHaveBeenCalledWith('electricity');
  });

  it('returns billers for valid type (airtime)', async () => {
    const { GET } = await import('./route');
    const airtimeBillers = [
      {
        billerId: 'mtn-1',
        billerName: 'MTN',
        billerType: 'airtime',
        categoryId: 'cat-2',
        categoryName: 'Airtime',
      },
    ];
    mockGetBillersByCategory.mockResolvedValue(airtimeBillers);

    const request = makeRequest({ type: 'airtime' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    const expected = airtimeBillers.map((b) => ({
      ...b,
      provider: 'kuda',
    }));
    expect(data.billers).toEqual(expected);
    expect(mockGetBillersByCategory).toHaveBeenCalledWith('airtime');
  });

  it('returns 400 for missing type param', async () => {
    const { GET } = await import('./route');

    const request = new NextRequest('http://localhost:3000/api/vtu/billers');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid bill type');
    expect(data.details).toBeDefined();
    expect(mockGetBillersByCategory).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid type', async () => {
    const { GET } = await import('./route');

    const request = makeRequest({ type: 'invalid_type' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid bill type');
    expect(data.details).toBeDefined();
    expect(mockGetBillersByCategory).not.toHaveBeenCalled();
  });

  it('returns 400 for empty string type', async () => {
    const { GET } = await import('./route');

    const request = makeRequest({ type: '' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid bill type');
    expect(mockGetBillersByCategory).not.toHaveBeenCalled();
  });

  it('returns 500 when getBillersByCategory throws', async () => {
    const { GET } = await import('./route');
    mockGetBillersByCategory.mockRejectedValue(
      new Error('Kuda API unavailable')
    );

    const request = makeRequest({ type: 'electricity' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch billers: Kuda API unavailable');
  });

  it('keeps biller submenu caching short-lived', async () => {
    const { GET } = await import('./route');

    const request = makeRequest({ type: 'data' });
    const response = await GET(request);

    expect(response.headers.get('Cache-Control')).toBe(
      'public, s-maxage=60, stale-while-revalidate=300'
    );
  });

  it('returns empty array when no billers found', async () => {
    const { GET } = await import('./route');
    mockGetBillersByCategory.mockResolvedValue([]);

    const request = makeRequest({ type: 'betting' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.billers).toEqual([]);
  });

  it('accepts all valid bill types', async () => {
    const { GET } = await import('./route');
    const validTypes = [
      'airtime',
      'data',
      'electricity',
      'cable_tv',
      'betting',
    ];

    for (const type of validTypes) {
      vi.clearAllMocks();
      const request = makeRequest({ type });
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(mockGetBillersByCategory).toHaveBeenCalledWith(type);
    }
  });

  it('aggregates both Kuda and Monnify billers for electricity', async () => {
    const { GET } = await import('./route');

    mockGetBillersByCategory.mockResolvedValue([
      {
        billerId: 'kuda-biller-1',
        billerName: 'Ikeja Electric (Kuda)',
        billerType: 'electricity',
        categoryId: 'cat-1',
        categoryName: 'Electricity',
        billItems: [
          {
            itemCode: 'kuda-item-1',
            itemName: 'Prepaid (Kuda)',
            amount: 0,
            itemCurrencySymbol: 'NGN',
            isAmountFixed: false,
            itemFee: 0,
          },
        ],
      },
    ]);

    mockMonnifyGetBillers.mockResolvedValue([
      {
        billerCode: 'IKEDC',
        name: 'Ikeja Electricity Distribution Company',
        billerCategoryCode: 'UTILITY_PAYMENT',
      },
    ]);

    mockMonnifyGetBillerProducts.mockResolvedValue([
      {
        productCode: 'IKEDC-PREPAID',
        name: 'Ikeja Electric prepaid (Monnify)',
        billerCode: 'IKEDC',
        fee: 100,
        amount: 0,
        isAmountFixed: false,
      },
    ]);

    const request = makeRequest({ type: 'electricity' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    const providers = data.billers.map((b: any) => b.provider);
    expect(providers).toContain('kuda');
    expect(providers).toContain('monnify');

    const kudaBiller = data.billers.find((b: any) => b.provider === 'kuda');
    expect(kudaBiller.billItems[0].provider).toBe('kuda');

    const monnifyBiller = data.billers.find(
      (b: any) => b.provider === 'monnify'
    );
    expect(monnifyBiller.billerCode).toBe('IKEDC');
    expect(monnifyBiller.billItems[0].provider).toBe('monnify');
    expect(monnifyBiller.billItems[0].productCode).toBe('IKEDC-PREPAID');
  });

  it('falls back gracefully if Monnify throws', async () => {
    const { GET } = await import('./route');

    mockGetBillersByCategory.mockResolvedValue([
      {
        billerId: 'kuda-biller-1',
        billerName: 'Ikeja Electric (Kuda)',
        billerType: 'electricity',
        categoryId: 'cat-1',
        categoryName: 'Electricity',
        billItems: [],
      },
    ]);

    mockMonnifyGetBillers.mockRejectedValue(new Error('Monnify API down'));

    const request = makeRequest({ type: 'electricity' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.billers).toHaveLength(1);
    expect(data.billers[0].provider).toBe('kuda');
  });

  it('falls back gracefully if Kuda throws but Monnify succeeds', async () => {
    const { GET } = await import('./route');

    mockGetBillersByCategory.mockRejectedValue(new Error('Kuda API down'));

    mockMonnifyGetBillers.mockResolvedValue([
      {
        billerCode: 'IKEDC',
        name: 'Ikeja Electricity Distribution Company',
        billerCategoryCode: 'UTILITY_PAYMENT',
      },
    ]);
    mockMonnifyGetBillerProducts.mockResolvedValue([
      {
        productCode: 'IKEDC-PREPAID',
        name: 'Ikeja Electric prepaid (Monnify)',
        billerCode: 'IKEDC',
        fee: 100,
        amount: 0,
        isAmountFixed: false,
      },
    ]);

    const request = makeRequest({ type: 'electricity' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.billers).toHaveLength(1);
    expect(data.billers[0].provider).toBe('monnify');
  });
});
