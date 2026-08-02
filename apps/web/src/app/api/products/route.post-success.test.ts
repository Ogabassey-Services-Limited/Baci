import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makePostRequest,
  mockGenerateProductSlug,
  mockScheduleProductImageTransformsPrewarm,
  mockScheduleStorefrontProductPurge,
  POST,
  validCreateBody,
} from './route.test-support';
import {
  MERCHANT_ID,
  PRODUCT_ID,
  productRouteTestState,
  resetProductRouteTestState,
} from './route-state.test-support';

describe('POST /api/products creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetProductRouteTestState();
  });

  it('creates product and returns 201', async () => {
    productRouteTestState.insertResult = {
      id: PRODUCT_ID,
      merchant_id: MERCHANT_ID,
      name: 'Test Product',
      price: '5000',
      stock_quantity: 100,
      slug: 'test-product',
    };

    const response = await POST(makePostRequest(validCreateBody));
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.product).toBeDefined();
    expect(json.product.id).toBe(PRODUCT_ID);
  });

  it('pre-warms the CDN image transforms for the new product', async () => {
    productRouteTestState.insertResult = {
      id: PRODUCT_ID,
      slug: 'test-product',
    };

    const response = await POST(makePostRequest(validCreateBody));

    expect(response.status).toBe(201);
    expect(mockScheduleProductImageTransformsPrewarm).toHaveBeenCalledWith([
      { url: 'https://example.com/image.png' },
    ]);
  });

  it('schedules a Cloudflare purge for the new product', async () => {
    productRouteTestState.insertResult = {
      id: PRODUCT_ID,
      slug: 'test-product',
    };

    const response = await POST(makePostRequest(validCreateBody));

    expect(response.status).toBe(201);
    expect(mockScheduleStorefrontProductPurge).toHaveBeenCalledWith(
      'test-store',
      [{ slug: 'test-product', categorySegment: 'electronics' }]
    );
  });

  it('falls back to the created id when the generated slug is blank', async () => {
    productRouteTestState.insertResult = { id: PRODUCT_ID, slug: '' };
    mockGenerateProductSlug.mockReturnValueOnce('');

    const response = await POST(makePostRequest(validCreateBody));

    expect(response.status).toBe(201);
    expect(mockScheduleStorefrontProductPurge).toHaveBeenCalledWith(
      'test-store',
      [{ slug: PRODUCT_ID, categorySegment: expect.anything() }]
    );
  });

  it('completes creation even when scheduling the purge throws', async () => {
    productRouteTestState.insertResult = {
      id: PRODUCT_ID,
      slug: 'test-product',
    };
    mockScheduleStorefrontProductPurge.mockImplementationOnce(() => {
      throw new Error('purge scheduling failed');
    });

    const response = await POST(makePostRequest(validCreateBody));

    expect(response.status).toBe(201);
  });

  it('persists unlimited-stock products as unmanaged inventory', async () => {
    productRouteTestState.insertResult = {
      id: PRODUCT_ID,
      merchant_id: MERCHANT_ID,
      name: 'Unlimited Product',
      price: '5000',
      stock_quantity: 0,
      slug: 'unlimited-product',
    };

    const response = await POST(
      makePostRequest({
        ...validCreateBody,
        name: 'Unlimited Product',
        stock: 0,
        manage_stock: false,
      })
    );

    expect(response.status).toBe(201);
    expect(
      productRouteTestState.lastProductsQueryChain?.insert
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        manage_stock: false,
        stock: 0,
        stock_quantity: 0,
      })
    );
  });

  it('creates product with variants', async () => {
    productRouteTestState.insertResult = {
      id: PRODUCT_ID,
      merchant_id: MERCHANT_ID,
      name: 'Test Product',
      has_variants: true,
    };

    const response = await POST(
      makePostRequest({
        ...validCreateBody,
        has_variants: true,
        color: 'Gold',
        variants: [
          {
            attributes: { size: 'M' },
            price: 5000,
            stock_quantity: 10,
            sku: 'SKU-M-RED',
          },
        ],
      })
    );
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.product.has_variants).toBe(true);
    expect(
      productRouteTestState.lastProductsQueryChain?.insert
    ).toHaveBeenCalledWith(expect.objectContaining({ color: 'Gold' }));
  });

  it('scopes rollback deletes to the merchant when variant creation fails', async () => {
    productRouteTestState.insertResult = {
      id: PRODUCT_ID,
      merchant_id: MERCHANT_ID,
      name: 'Test Product',
      has_variants: true,
    };
    productRouteTestState.variantsInsertError = {
      message: 'Variant insert failed',
    };

    const response = await POST(
      makePostRequest({
        ...validCreateBody,
        has_variants: true,
        variants: [
          {
            attributes: { size: 'M' },
            price: 5000,
            stock_quantity: 10,
            sku: 'SKU-M-RED',
          },
        ],
      })
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.rolledBack).toBe(true);
    expect(
      productRouteTestState.lastProductsQueryChain?.delete
    ).toHaveBeenCalled();
    expect(
      productRouteTestState.lastProductsQueryChain?.eq
    ).toHaveBeenCalledWith('id', PRODUCT_ID);
    expect(
      productRouteTestState.lastProductsQueryChain?.eq
    ).toHaveBeenCalledWith('merchant_id', MERCHANT_ID);
  });

  it('triggers embedding generation asynchronously', async () => {
    productRouteTestState.insertResult = { id: PRODUCT_ID };

    const response = await POST(makePostRequest(validCreateBody));

    expect(response.status).toBe(201);
  });
});
