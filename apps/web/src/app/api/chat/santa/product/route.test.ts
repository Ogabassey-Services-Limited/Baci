import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SANTA_MERCHANT_SLUG_HEADER } from '@/lib/agentic/santa-merchant-slug-header';

const mocks = vi.hoisted(() => ({
  resolveSantaTenant: vi.fn(),
  createPublicClient: vi.fn(),
}));

vi.mock('@/lib/agentic/resolve-santa-tenant', () => ({
  resolveSantaTenant: mocks.resolveSantaTenant,
}));
vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: mocks.createPublicClient,
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { GET, POST } from './route';

const MERCHANT_ID = 'merchant-1';
const MERCHANT_SLUG = 'winter-store';

function createProductQuery(result: { data: unknown; error: unknown }) {
  const query = Object.assign(Promise.resolve(result), {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    single: vi.fn(),
  });

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.single.mockResolvedValue(result);
  return query;
}

function publicClientReturning(
  product: Record<string, unknown> | null,
  products: Array<{ name: string; price: number }> = [
    { name: 'Lego Set', price: 1000 },
  ]
) {
  const candidateQuery = createProductQuery({ data: products, error: null });
  const detailQuery = createProductQuery({
    data: product,
    error: product ? null : {},
  });
  return {
    from: vi
      .fn()
      .mockReturnValueOnce(candidateQuery)
      .mockReturnValueOnce(detailQuery),
  };
}

const PRODUCT = {
  id: 'p1',
  name: 'Lego Set',
  slug: 'lego-set',
  description: 'Bricks',
  price: 1000,
  images: [],
  status: 'active',
  merchant_id: MERCHANT_ID,
  stock: 5,
  stock_quantity: 5,
  manage_stock: true,
  brand: 'Lego',
  sku: 'L1',
};

function postRequest(body: unknown) {
  return new NextRequest('https://baci.app/api/chat/santa/product', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function getRequest(query: string) {
  return new NextRequest(
    `https://baci.app/api/chat/santa/product${query}`
  ) as NextRequest;
}

describe('/api/chat/santa/product', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createPublicClient.mockReturnValue(publicClientReturning(PRODUCT));
    mocks.resolveSantaTenant.mockResolvedValue({
      id: MERCHANT_ID,
      slug: MERCHANT_SLUG,
    });
  });

  describe('tenant resolution', () => {
    it('uses the single resolved tenant for catalogue and product reads', async () => {
      // The anon policy on `merchants` is `USING (is_published IS TRUE)`, so an
      // unpublished store resolves to nothing. Resolving with the service-role
      // client would step over that gate on an unauthenticated endpoint.
      const response = await POST(postRequest({ name: 'Lego Set' }));

      expect(mocks.resolveSantaTenant).toHaveBeenCalledTimes(1);
      expect(mocks.createPublicClient).toHaveBeenCalledWith({
        clientInfo: 'baci-santa-product-lookup',
        timeoutMs: 4000,
      });
      expect(response.headers.get(SANTA_MERCHANT_SLUG_HEADER)).toBe(
        MERCHANT_SLUG
      );
    });

    it('returns 503 when the tenant is not configured', async () => {
      mocks.resolveSantaTenant.mockResolvedValue(null);

      const response = await POST(postRequest({ name: 'Lego Set' }));

      expect(response.status).toBe(503);
      // Fail closed: no catalogue read at all.
      expect(mocks.createPublicClient).not.toHaveBeenCalled();
    });
  });

  describe('POST', () => {
    it('returns the matched product', async () => {
      const response = await POST(postRequest({ name: 'Lego Set' }));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        product: expect.objectContaining({ name: 'Lego Set' }),
      });
    });

    it('scopes the product query to the resolved merchant', async () => {
      await POST(postRequest({ name: 'Lego Set' }));

      expect(mocks.createPublicClient).toHaveBeenCalled();
    });

    it('returns a null product when nothing matches', async () => {
      mocks.createPublicClient.mockReturnValue(
        publicClientReturning(PRODUCT, [{ name: 'Train', price: 1000 }])
      );

      const response = await POST(postRequest({ name: 'Lego Set' }));

      await expect(response.json()).resolves.toEqual({ product: null });
    });

    it.each([
      ['a malformed body', 'not json'],
      ['a missing name', JSON.stringify({})],
      ['a non-string name', JSON.stringify({ name: 42 })],
    ])('returns 400 for %s', async (_label, body) => {
      const request = new NextRequest(
        'https://baci.app/api/chat/santa/product',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
        }
      );

      expect((await POST(request)).status).toBe(400);
    });

    it('rejects a name longer than 200 characters', async () => {
      const response = await POST(postRequest({ name: 'a'.repeat(201) }));

      expect(response.status).toBe(400);
    });
  });

  describe('GET', () => {
    it('looks up the product named in the query string', async () => {
      const response = await GET(getRequest('?name=Lego%20Set'));

      expect((await response).status).toBe(200);
      expect(mocks.resolveSantaTenant).toHaveBeenCalledTimes(1);
    });

    it('returns 400 when no name is given', async () => {
      const response = await GET(getRequest(''));

      expect((await response).status).toBe(400);
    });
  });
});
