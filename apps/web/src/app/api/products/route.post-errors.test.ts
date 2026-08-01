import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makePostRequest, POST, validCreateBody } from './route.test-support';
import {
  productRouteTestState,
  resetProductRouteTestState,
} from './route-state.test-support';

describe('POST /api/products guards and errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetProductRouteTestState();
  });

  it('returns 401 when user is not authenticated', async () => {
    productRouteTestState.authUser = null;

    const response = await POST(makePostRequest(validCreateBody));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 403 when CSRF check fails', async () => {
    productRouteTestState.csrfValid = false;

    const response = await POST(makePostRequest(validCreateBody));
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe('CSRF validation failed');
  });

  it('returns 404 when merchant not found', async () => {
    productRouteTestState.merchantContext.current = null;

    const response = await POST(makePostRequest(validCreateBody));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe('Merchant not found');
  });

  it('returns 409 when product with same slug exists', async () => {
    productRouteTestState.existingProduct = { id: 'existing-product-id' };

    const response = await POST(makePostRequest(validCreateBody));
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toBe('A product with this name already exists.');
  });

  it('returns 500 when product insertion fails', async () => {
    productRouteTestState.insertError = { message: 'Insert failed' };

    const response = await POST(makePostRequest(validCreateBody));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe('Failed to create product');
  });

  it('returns 500 on unexpected error', async () => {
    productRouteTestState.authUser = undefined;

    const response = await POST(makePostRequest(validCreateBody));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe('Internal server error');
  });
});
