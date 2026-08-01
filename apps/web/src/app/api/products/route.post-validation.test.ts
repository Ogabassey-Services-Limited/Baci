import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makePostRequest, POST, validCreateBody } from './route.test-support';
import {
  MERCHANT_ID,
  PRODUCT_ID,
  productRouteTestState,
  resetProductRouteTestState,
} from './route-state.test-support';

describe('POST /api/products validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetProductRouteTestState();
  });

  it('returns 400 when name is missing', async () => {
    const { name: _, ...body } = validCreateBody;
    const response = await POST(makePostRequest(body));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Validation failed');
    expect(json.details).toBeDefined();
  });

  it('returns 400 when price is negative', async () => {
    const response = await POST(
      makePostRequest({ ...validCreateBody, price: -100 })
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe('Validation failed');
  });

  it('rejects sku_matrix products when a variant lacks price_override', async () => {
    const response = await POST(
      makePostRequest({
        ...validCreateBody,
        has_variants: true,
        variant_model: 'sku_matrix',
        variants: [
          {
            condition: 'used',
            attributes: { storage: '256GB' },
            stock_quantity: 2,
          },
        ],
      })
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe(
      'Every sku_matrix variant must include a non-negative price_override.'
    );
  });

  it('accepts sku_matrix products when every variant includes price_override', async () => {
    productRouteTestState.insertResult = {
      id: PRODUCT_ID,
      merchant_id: MERCHANT_ID,
      name: 'Matrix Product',
    };

    const response = await POST(
      makePostRequest({
        ...validCreateBody,
        has_variants: true,
        variant_model: 'sku_matrix',
        variants: [
          {
            condition: 'used',
            attributes: { storage: '256GB' },
            price_override: 4500,
            stock_quantity: 2,
          },
        ],
      })
    );

    expect(response.status).toBe(201);
  });
});
