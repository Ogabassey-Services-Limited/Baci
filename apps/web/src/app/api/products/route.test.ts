import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, makeGetRequest } from './route.test-support';
import {
  productRouteTestState,
  resetProductRouteTestState,
} from './route-state.test-support';

describe('GET /api/products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetProductRouteTestState();
  });

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      productRouteTestState.authUser = null;

      const response = await GET(makeGetRequest());
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error).toBe('Unauthorized');
    });
  });

  describe('merchant lookup', () => {
    it('returns 404 when merchant not found', async () => {
      productRouteTestState.merchantContext.current = null;

      const response = await GET(makeGetRequest());
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error).toBe('Merchant not found');
    });
  });

  describe('success with products', () => {
    it('returns products with pagination and stats', async () => {
      productRouteTestState.products = [
        {
          id: 'product-456',
          name: 'Product 1',
          description: 'Description 1',
          price: '1000',
          stock_quantity: 50,
          status: 'active',
          manage_stock: true,
          images: [{ url: 'https://example.com/p1.png' }],
          variants: [],
          has_variants: false,
          category: 'General',
          sku: 'SKU-001',
          slug: 'product-1',
        },
      ];
      productRouteTestState.productsCount = 1;

      const response = await GET(makeGetRequest());
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.products).toHaveLength(1);
      expect(json.products[0].name).toBe('Product 1');
      expect(json.pagination.total).toBe(1);
      expect(json.stats.inventoryValue).toBe(50000);
    });

    it('applies ids filter and ignores pagination', async () => {
      const response = await GET(makeGetRequest({ ids: 'id1,id2,id3' }));

      expect(response.status).toBe(200);
    });

    it('handles stats RPC fallback gracefully', async () => {
      productRouteTestState.rpcError = { message: 'RPC not found' };
      productRouteTestState.products = [
        {
          id: 'product-456',
          name: 'Product 1',
          price: '1000',
          stock_quantity: 10,
          status: 'active',
          manage_stock: true,
          category: 'Electronics',
          variants: [],
        },
      ];
      productRouteTestState.productsCount = 1;

      const response = await GET(makeGetRequest());
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.stats).toBeDefined();
      expect(json.stats.inventoryValue).toBeGreaterThanOrEqual(0);
    });

    it('applies migration_status filter for explicit review queues', async () => {
      const response = await GET(makeGetRequest({ migration: 'needs_review' }));

      expect(response.status).toBe(200);
      expect(
        productRouteTestState.lastProductsQueryChain?.eq
      ).toHaveBeenCalledWith('migration_status', 'needs_review');
    });

    it('treats pending migration filter as pending or null rows', async () => {
      const response = await GET(makeGetRequest({ migration: 'pending' }));

      expect(response.status).toBe(200);
      expect(
        productRouteTestState.lastProductsQueryChain?.or
      ).toHaveBeenCalledWith(
        'migration_status.eq.pending,migration_status.is.null'
      );
    });

    it('rejects invalid migration filters', async () => {
      const response = await GET(makeGetRequest({ migration: 'broken' }));
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.error).toBe('Invalid query parameters');
    });
  });

  describe('error handling', () => {
    it('returns 500 on database error', async () => {
      productRouteTestState.productsError = { message: 'Database error' };

      const response = await GET(makeGetRequest());
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('Failed to fetch products');
    });

    it('returns 500 on unexpected error', async () => {
      productRouteTestState.authUser = undefined;

      const response = await GET(makeGetRequest());
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('Internal server error');
    });
  });
});
