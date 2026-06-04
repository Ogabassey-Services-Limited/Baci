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
  billItems?: BillItem[];
}

interface BillItem {
  itemCode: string;
  itemName: string;
  amount: number;
  itemCurrencySymbol: string;
  isAmountFixed: boolean;
  itemFee: number;
  billItems?: BillItem[];
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

  it('preserves nested Kuda bill items so the storefront can select leaf products', async () => {
    const { GET } = await import('./route');
    mockGetBillersByCategory.mockResolvedValue([
      {
        billerId: 'ekedc',
        billerName: 'Eko Electricity',
        billerType: 'electricity',
        categoryId: 'electricity',
        categoryName: 'Electricity',
        billItems: [
          {
            itemCode: 'prepaid',
            itemName: 'Prepaid',
            amount: 0,
            itemCurrencySymbol: 'NGN',
            isAmountFixed: false,
            itemFee: 0,
            billItems: [
              {
                itemCode: 'residential-prepaid',
                itemName: 'Residential Prepaid',
                amount: 0,
                itemCurrencySymbol: 'NGN',
                isAmountFixed: false,
                itemFee: 0,
              },
            ],
          },
        ],
      },
    ]);

    const request = makeRequest({ type: 'electricity' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.billers[0].billItems[0]).toEqual({
      itemCode: 'prepaid',
      itemName: 'Prepaid',
      amount: 0,
      itemCurrencySymbol: 'NGN',
      isAmountFixed: false,
      itemFee: 0,
      provider: 'kuda',
      billItems: [
        {
          itemCode: 'residential-prepaid',
          itemName: 'Residential Prepaid',
          amount: 0,
          itemCurrencySymbol: 'NGN',
          isAmountFixed: false,
          itemFee: 0,
          provider: 'kuda',
        },
      ],
    });
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
        description: 'Ikeja Electricity Distribution Company',
        name: 'Ikeja Electricity Distribution Company',
        billerCategoryCode: 'ELECTRICITY',
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

    interface TestBillItem {
      itemCode: string;
      itemName: string;
      provider: string;
      billerCode?: string;
      productCode?: string;
    }

    interface TestBiller {
      billerId: string;
      billerName: string;
      provider: string;
      billerCode?: string;
      billItems: TestBillItem[];
    }

    const billers = data.billers as TestBiller[];
    expect(Array.isArray(billers)).toBe(true);

    for (const biller of billers) {
      expect(biller.provider).toBeDefined();
      expect(typeof biller.provider).toBe('string');
      for (const item of biller.billItems) {
        expect(item.provider).toBeDefined();
        expect(typeof item.provider).toBe('string');
        if (item.provider === 'monnify') {
          expect(item.billerCode).toBeDefined();
          expect(item.productCode).toBeDefined();
        }
      }
    }

    const providers = billers.map((b) => b.provider);
    expect(providers).toContain('kuda');
    expect(providers).toContain('monnify');
    expect(mockMonnifyGetBillers).toHaveBeenCalledWith('ELECTRICITY');

    const kudaBiller = billers.find((b) => b.provider === 'kuda');
    expect(kudaBiller).toBeDefined();
    expect(kudaBiller?.billItems[0]?.provider).toBe('kuda');

    const monnifyBiller = billers.find((b) => b.provider === 'monnify');
    expect(monnifyBiller).toBeDefined();
    expect(monnifyBiller?.billerCode).toBe('IKEDC');
    expect(monnifyBiller?.billItems[0]?.provider).toBe('monnify');
    expect(monnifyBiller?.billItems[0]?.productCode).toBe('IKEDC-PREPAID');
  });

  it('uses documented Monnify bill category codes for supported categories only', async () => {
    const { GET } = await import('./route');

    await GET(makeRequest({ type: 'electricity' }));
    expect(mockMonnifyGetBillers).toHaveBeenLastCalledWith('ELECTRICITY');

    await GET(makeRequest({ type: 'cable_tv' }));
    expect(mockMonnifyGetBillers).toHaveBeenLastCalledWith('CABLE_TV');

    await GET(makeRequest({ type: 'betting' }));
    expect(mockMonnifyGetBillers).toHaveBeenCalledTimes(2);
  });

  it('omits Monnify billers that have no usable products', async () => {
    const { GET } = await import('./route');
    mockGetBillersByCategory.mockResolvedValue([]);
    mockMonnifyGetBillers.mockResolvedValue([
      {
        billerCode: 'IKEDC',
        description: 'Ikeja Electricity Distribution Company',
        name: 'Ikeja Electricity Distribution Company',
        billerCategoryCode: 'ELECTRICITY',
      },
      {
        billerCode: 'EKEDC',
        description: 'Eko Electricity Distribution Company',
        name: 'Eko Electricity Distribution Company',
        billerCategoryCode: 'ELECTRICITY',
      },
    ]);
    mockMonnifyGetBillerProducts.mockImplementation((billerCode: string) =>
      Promise.resolve(
        billerCode === 'EKEDC'
          ? [
              {
                productCode: 'EKEDC-PREPAID',
                name: 'Eko Electric prepaid',
                billerCode: 'EKEDC',
                fee: 100,
                amount: 0,
                isAmountFixed: false,
              },
            ]
          : []
      )
    );

    const request = makeRequest({ type: 'electricity' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.billers).toHaveLength(1);
    expect(data.billers[0]).toMatchObject({
      billerCode: 'EKEDC',
      provider: 'monnify',
    });
  });

  it('limits concurrent Monnify product lookups for large categories', async () => {
    const { GET } = await import('./route');
    let activeProductLookups = 0;
    let maxActiveProductLookups = 0;

    mockGetBillersByCategory.mockResolvedValue([]);
    mockMonnifyGetBillers.mockResolvedValue(
      Array.from({ length: 8 }, (_, index) => ({
        billerCode: `BILLER-${index}`,
        description: `Biller ${index}`,
        name: `Biller ${index}`,
        billerCategoryCode: 'ELECTRICITY',
      }))
    );
    mockMonnifyGetBillerProducts.mockImplementation(
      async (billerCode: string) => {
        activeProductLookups += 1;
        maxActiveProductLookups = Math.max(
          maxActiveProductLookups,
          activeProductLookups
        );
        await new Promise((resolve) => setTimeout(resolve, 1));
        activeProductLookups -= 1;
        return [
          {
            productCode: `${billerCode}-PRODUCT`,
            name: `${billerCode} product`,
            billerCode,
            fee: 0,
            amount: 0,
            isAmountFixed: false,
          },
        ];
      }
    );

    const response = await GET(makeRequest({ type: 'electricity' }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.billers).toHaveLength(8);
    expect(maxActiveProductLookups).toBeLessThanOrEqual(4);
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

  it('rejects malformed Kuda biller payloads instead of accepting type assertions', async () => {
    const { GET } = await import('./route');

    mockGetBillersByCategory.mockResolvedValue([
      {
        billerId: 'kuda-biller-1',
        billerName: 'Ikeja Electric',
        billerType: 'electricity',
        categoryId: 'cat-1',
        categoryName: 'Electricity',
        billItems: [
          {
            itemCode: 'kuda-item-1',
            itemName: 'Prepaid',
            amount: 'invalid',
            itemCurrencySymbol: 'NGN',
            isAmountFixed: false,
            itemFee: 0,
          },
        ],
      },
    ]);
    mockMonnifyGetBillers.mockResolvedValue([]);

    const request = makeRequest({ type: 'electricity' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Kuda biller payload failed validation');
  });

  it('falls back gracefully if Kuda throws but Monnify succeeds', async () => {
    const { GET } = await import('./route');

    mockGetBillersByCategory.mockRejectedValue(new Error('Kuda API down'));

    mockMonnifyGetBillers.mockResolvedValue([
      {
        billerCode: 'IKEDC',
        description: 'Ikeja Electricity Distribution Company',
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
