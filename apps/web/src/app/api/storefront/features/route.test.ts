import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- Mocks ----

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve({ getAll: () => [] })),
}));

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();

const mockFrom = vi.fn(() => ({
  select: mockSelect,
}));

mockSelect.mockReturnValue({
  eq: mockEq,
});

mockEq.mockReturnValue({
  maybeSingle: mockMaybeSingle,
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

// ---- Helpers ----

function makeRequest(url: string): NextRequest {
  return new NextRequest(url, {
    method: 'GET',
  });
}

// ---- Tests ----

describe('GET /api/storefront/features', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
  });

  it('returns 400 when merchantId and slug are missing', async () => {
    const { GET } = await import('./route');
    const req = makeRequest('http://localhost:3000/api/storefront/features');
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('merchantId or slug is required');
  });

  it('returns 404 when merchant by slug is not found', async () => {
    const { GET } = await import('./route');
    const req = makeRequest(
      'http://localhost:3000/api/storefront/features?slug=missing-store'
    );

    // Mock merchant lookup returning null
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const res = await GET(req);

    expect(mockFrom).toHaveBeenCalledWith('merchants');
    expect(mockEq).toHaveBeenCalledWith('slug', 'missing-store');

    const json = await res.json();
    expect(res.status).toBe(404);
    expect(json.error).toBe('Store not found');
  });

  it('fetches settings using explicit columns from source', async () => {
    const { GET, SETTINGS_COLUMNS_LIST } = await import('./route');
    const req = makeRequest(
      'http://localhost:3000/api/storefront/features?merchantId=123'
    );

    // Mock settings lookup returning data
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'settings-1', merchant_id: '123' },
      error: null,
    });

    const res = await GET(req);

    expect(mockFrom).toHaveBeenCalledWith('merchant_feature_settings');

    // Use the exported column list from the source -- no hardcoded duplication
    const expectedColumns = SETTINGS_COLUMNS_LIST.join(', ');
    expect(mockSelect).toHaveBeenCalledWith(expectedColumns);

    expect(res.status).toBe(200);
  });

  it('handles DB errors gracefully', async () => {
    const { GET } = await import('./route');
    const req = makeRequest(
      'http://localhost:3000/api/storefront/features?merchantId=123'
    );

    // Mock settings lookup returning error
    mockMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'DB Error' },
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // suppress console.error
    });

    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    // Should return defaults
    expect(json.loyaltyEnabled).toBe(false);

    consoleSpy.mockRestore();
  });
});
