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

vi.mock('@/lib/kuda-bills', () => ({
  getBillersByCategory: (...args: unknown[]) =>
    mockGetBillersByCategory(...args),
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
  });

  it('returns billers for valid type (electricity)', async () => {
    const { GET } = await import('./route');

    const request = makeRequest({ type: 'electricity' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.billers).toEqual(mockBillers);
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
    expect(data.billers).toEqual(airtimeBillers);
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
});
