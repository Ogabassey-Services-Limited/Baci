import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const wishlistRouteMocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: wishlistRouteMocks.cookies,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: wishlistRouteMocks.createClient,
}));

function makePostRequest(body: Record<string, unknown>) {
  return new NextRequest('https://usebaci.com/api/wishlist', {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
}

describe('POST /api/wishlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wishlistRouteMocks.cookies.mockResolvedValue({});
  });

  it('selects explicit columns after inserting a wishlist item', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        created_at: '2026-06-02T00:00:00.000Z',
        customer_email: 'customer@example.com',
        id: 'wishlist-1',
        merchant_id: '22222222-2222-4222-8222-222222222222',
        product_id: '11111111-1111-4111-8111-111111111111',
      },
      error: null,
    });
    const selectMock = vi.fn(() => ({ single: singleMock }));
    const insertMock = vi.fn(() => ({ select: selectMock }));
    const fromMock = vi.fn(() => ({ insert: insertMock }));

    wishlistRouteMocks.createClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { email: 'customer@example.com' } },
        }),
      },
      from: fromMock,
    });

    const response = await POST(
      makePostRequest({
        merchantId: '22222222-2222-4222-8222-222222222222',
        productId: '11111111-1111-4111-8111-111111111111',
      })
    );
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.item.id).toBe('wishlist-1');
    expect(selectMock).toHaveBeenCalledWith(
      'id, product_id, merchant_id, customer_email, created_at'
    );
  });

  it('returns 400 when IDs are missing or malformed', async () => {
    const response = await POST(
      makePostRequest({
        merchantId: 'not-a-uuid',
        productId: '11111111-1111-4111-8111-111111111111',
      })
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe(
      'Product ID and Merchant ID are required and must be valid UUIDs'
    );
    expect(wishlistRouteMocks.createClient).not.toHaveBeenCalled();
  });
});
