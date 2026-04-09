import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

describe('POST /api/orders/reuse', () => {
  const mockRpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cookies).mockResolvedValue({} as never);
    vi.mocked(createClient).mockReturnValue({
      rpc: mockRpc,
    } as never);
  });

  it('reopens a reusable pending order', async () => {
    mockRpc.mockResolvedValue({
      data: {
        id: 'order-123',
        order_number: 'ORD-123',
        tracking_token: 'tracking-token-123',
      },
      error: null,
    });

    const request = new NextRequest('http://localhost/api/orders/reuse', {
      method: 'POST',
      body: JSON.stringify({
        order_id: '4dc0ee52-d9c4-406a-b6ca-80c84eef6a8f',
        merchant_id: 'e6e2e46c-5e3c-40c1-b0ae-832d6d20f0a2',
        tracking_token: 'tracking-token-123',
        customer_email: 'john@example.com',
        payment_method: 'card',
        shipping_provider: 'GIGL',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      order: {
        id: 'order-123',
        order_number: 'ORD-123',
        tracking_token: 'tracking-token-123',
      },
    });
    expect(mockRpc).toHaveBeenCalledWith(
      'prepare_storefront_order_for_checkout',
      expect.objectContaining({
        p_payment_method: 'card',
      })
    );
  });

  it('returns 400 for invalid input', async () => {
    const request = new NextRequest('http://localhost/api/orders/reuse', {
      method: 'POST',
      body: JSON.stringify({
        order_id: 'not-a-uuid',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid request data');
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('maps already-paid orders to 409', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'order_already_paid' },
    });

    const request = new NextRequest('http://localhost/api/orders/reuse', {
      method: 'POST',
      body: JSON.stringify({
        order_id: '4dc0ee52-d9c4-406a-b6ca-80c84eef6a8f',
        merchant_id: 'e6e2e46c-5e3c-40c1-b0ae-832d6d20f0a2',
        tracking_token: 'tracking-token-123',
        customer_email: 'john@example.com',
        payment_method: 'card',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data).toEqual({ error: 'Order is no longer reusable' });
  });
});
