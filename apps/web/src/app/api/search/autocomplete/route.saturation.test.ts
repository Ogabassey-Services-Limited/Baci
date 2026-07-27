import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetStorefrontAutocompleteProducts, mockWarn } = vi.hoisted(() => ({
  mockGetStorefrontAutocompleteProducts: vi.fn(),
  mockWarn: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ get: vi.fn() }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({})),
}));
vi.mock('@/lib/storefront-search-autocomplete', () => ({
  AUTOCOMPLETE_SATURATED_CODE: 'autocomplete_saturated',
  getStorefrontAutocompleteProducts: mockGetStorefrontAutocompleteProducts,
}));

import { GET } from './route';

const MERCHANT_ID = '123e4567-e89b-12d3-a456-426614174000';

describe('GET /api/search/autocomplete saturation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(mockWarn);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns an empty 200 response and records a saturation warning', async () => {
    mockGetStorefrontAutocompleteProducts.mockRejectedValue(
      Object.assign(new Error('capacity exhausted'), {
        code: 'autocomplete_saturated',
      })
    );

    const response = await GET(
      new NextRequest(
        `http://localhost:3000/api/search/autocomplete?q=iphone&merchant_id=${MERCHANT_ID}`
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      suggestions: [],
      popularSearches: [],
    });
    expect(mockWarn).toHaveBeenCalledWith(
      'Autocomplete saturated; returning empty suggestions for this request'
    );
  });
});
