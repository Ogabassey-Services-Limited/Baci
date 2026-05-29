import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockGetUserAccess = vi.fn();
const mockHasPermission = vi.fn();

const merchantBuilder = {
  eq: vi.fn(() => merchantBuilder),
  maybeSingle: vi.fn(),
  select: vi.fn(() => merchantBuilder),
};
const productsBuilder = {
  eq: vi.fn(() => productsBuilder),
  limit: vi.fn(),
  order: vi.fn(() => productsBuilder),
  select: vi.fn(() => productsBuilder),
};
const from = vi.fn((table: string) => {
  if (table === 'merchants') return merchantBuilder;
  if (table === 'products') return productsBuilder;
  return {};
});

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  getUserAccess: (...args: unknown[]) => mockGetUserAccess(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

const { GET } = await import('./route');

describe('GET /api/merchant/quiz/prize-products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: { from },
      user: { id: 'user-1' },
    });
    mockGetUserAccess.mockResolvedValue({
      merchantId: 'merchant-1',
      permissions: {},
      role: 'owner',
    });
    mockHasPermission.mockReturnValue(true);
    merchantBuilder.maybeSingle.mockResolvedValue({
      data: { slug: 'ogabassey' },
      error: null,
    });
    productsBuilder.limit.mockResolvedValue({
      data: [
        {
          default_variant_id: null,
          id: '55555555-5555-4555-8555-555555555555',
          images: [{ url: 'https://cdn.example.com/iphone.png' }],
          name: 'iPhone 15 Pro Max',
          price: '2100000',
        },
      ],
      error: null,
    });
  });

  it('returns active Ogabassey products that can be selected as quiz prizes', async () => {
    const response = await GET(new Request('http://localhost/api'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      products: [
        {
          defaultVariantId: null,
          id: '55555555-5555-4555-8555-555555555555',
          imageUrl: 'https://cdn.example.com/iphone.png',
          name: 'iPhone 15 Pro Max',
          price: 2100000,
        },
      ],
    });
    expect(productsBuilder.select).toHaveBeenCalledWith(
      'id, name, price, images, default_variant_id'
    );
    expect(productsBuilder.eq).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-1'
    );
    expect(productsBuilder.eq).toHaveBeenCalledWith('status', 'active');
  });

  it('rejects non-Ogabassey merchants', async () => {
    merchantBuilder.maybeSingle.mockResolvedValueOnce({
      data: { slug: 'another-store' },
      error: null,
    });

    const response = await GET(new Request('http://localhost/api'));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'Quiz creation is only available for Ogabassey',
    });
    expect(productsBuilder.select).not.toHaveBeenCalled();
  });

  it('returns 401 when the request is unauthorized', async () => {
    mockAuthenticateApiRequest.mockResolvedValueOnce({
      error: 'Unauthorized',
      supabase: null,
      user: null,
    });

    const response = await GET(new Request('http://localhost/api'));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(mockGetUserAccess).not.toHaveBeenCalled();
  });

  it('returns 404 when merchant access is missing', async () => {
    mockGetUserAccess.mockResolvedValueOnce(null);

    const response = await GET(new Request('http://localhost/api'));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Merchant not found' });
    expect(productsBuilder.select).not.toHaveBeenCalled();
  });

  it('returns 403 when the user cannot edit marketing settings', async () => {
    mockHasPermission.mockReturnValueOnce(false);

    const response = await GET(new Request('http://localhost/api'));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Permission denied' });
    expect(productsBuilder.select).not.toHaveBeenCalled();
  });

  it('returns 500 when the merchant slug lookup fails', async () => {
    merchantBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'database unavailable' },
    });

    const response = await GET(new Request('http://localhost/api'));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to load prize products',
    });
    expect(productsBuilder.select).not.toHaveBeenCalled();
  });

  it('returns 500 when the prize product lookup fails', async () => {
    productsBuilder.limit.mockResolvedValueOnce({
      data: null,
      error: { message: 'database unavailable' },
    });

    const response = await GET(new Request('http://localhost/api'));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to load prize products',
    });
  });
});
