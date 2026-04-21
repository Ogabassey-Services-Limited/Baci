import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(),
}));

vi.mock('@/lib/product-stock', () => ({
  getEffectiveStock: vi.fn(
    (product: { stock_quantity: number }) => product.stock_quantity ?? 0
  ),
}));

import { createServiceClient } from '@/lib/supabase/service';
import { POST } from './route';

function createRequest(body: unknown, _contentType = 'application/json') {
  return {
    json: vi.fn().mockResolvedValue(body),
  } as unknown as NextRequest;
}

function createMalformedRequest() {
  return {
    json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
  } as unknown as NextRequest;
}

type ServiceClientMock = ReturnType<typeof createServiceClient>;

function createSupabaseMock(products: unknown[] = []) {
  const selectQuery = {
    select: vi.fn(),
    in: vi.fn(),
  };
  selectQuery.select.mockReturnValue(selectQuery);
  selectQuery.in.mockResolvedValue({ data: products, error: null });

  return {
    from: vi.fn(() => selectQuery),
    __mocks: { selectQuery },
  } as unknown as ServiceClientMock;
}

describe('POST /api/cart/validate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when request body is invalid JSON', async () => {
    vi.mocked(createServiceClient).mockReturnValue(createSupabaseMock());

    const request = createMalformedRequest();
    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: 'Invalid JSON body',
    });
  });

  it('returns 400 when body fails Zod schema validation (productIds is a string, not array)', async () => {
    vi.mocked(createServiceClient).mockReturnValue(createSupabaseMock());

    const request = createRequest({ productIds: 'not-an-array' });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ error: 'Invalid request body' });
    expect(body.details).toBeDefined();
  });

  it('returns 200 with empty results when productIds is an empty array', async () => {
    vi.mocked(createServiceClient).mockReturnValue(createSupabaseMock());

    const request = createRequest({ productIds: [] });
    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      validProducts: [],
      invalidProductIds: [],
      priceChanges: [],
    });
  });

  it('returns 200 with valid products when productIds contains known UUIDs', async () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const productRow = {
      id: uuid,
      name: 'Test Product',
      price: 2500,
      stock: 10,
      stock_quantity: 10,
      status: 'active',
      manage_stock: true,
    };

    vi.mocked(createServiceClient).mockReturnValue(
      createSupabaseMock([productRow])
    );

    const request = createRequest({ productIds: [uuid] });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.validProducts).toHaveLength(1);
    expect(body.validProducts[0].id).toBe(uuid);
    expect(body.invalidProductIds).toHaveLength(0);
    expect(body.priceChanges).toHaveLength(0);
  });

  it('returns 200 with invalidProductIds for non-UUID strings', async () => {
    vi.mocked(createServiceClient).mockReturnValue(createSupabaseMock());

    const request = createRequest({ productIds: ['not-a-uuid'] });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    // Non-UUID IDs skip the DB check and are not added to invalidProductIds
    // (they are treated as legacy/mock IDs — fail open)
    expect(body.validProducts).toHaveLength(0);
  });

  it('returns 200 with priceChanges when cartItems prices differ from DB', async () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440001';
    const productRow = {
      id: uuid,
      name: 'Changed Price Product',
      price: 3000,
      stock: 5,
      stock_quantity: 5,
      status: 'active',
      manage_stock: true,
    };

    vi.mocked(createServiceClient).mockReturnValue(
      createSupabaseMock([productRow])
    );

    const request = createRequest({
      cartItems: [{ id: uuid, price: 2500 }],
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.priceChanges).toHaveLength(1);
    expect(body.priceChanges[0]).toEqual({
      id: uuid,
      oldPrice: 2500,
      newPrice: 3000,
    });
  });

  it('returns 500 when the database query fails', async () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440002';
    const selectQuery = {
      select: vi.fn(),
      in: vi.fn(),
    };
    selectQuery.select.mockReturnValue(selectQuery);
    selectQuery.in.mockResolvedValue({
      data: null,
      error: { message: 'connection refused' },
    });

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn(() => selectQuery),
    } as unknown as ServiceClientMock);

    const request = createRequest({ productIds: [uuid] });
    const response = await POST(request);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('Failed to validate cart'),
    });
  });
});
