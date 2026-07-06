import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mockEnrichShippingAddressWithQuoteDestination = vi.hoisted(() => vi.fn());

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
}));

vi.mock('@/lib/shipping/order-quote-destination', () => {
  class OrderQuoteDestinationMismatchError extends Error {
    readonly status = 400;

    constructor(
      message = 'The saved international shipping quote no longer matches this checkout. Please get a new quote before checkout.',
      readonly code = 'INTERNATIONAL_QUOTE_ORDER_MISMATCH'
    ) {
      super(message);
    }
  }

  return {
    enrichShippingAddressWithQuoteDestination:
      mockEnrichShippingAddressWithQuoteDestination,
    OrderQuoteDestinationMismatchError,
  };
});

import { cookies } from 'next/headers';
import { checkCsrfProtection } from '@/lib/csrf';
import { OrderQuoteDestinationMismatchError } from '@/lib/shipping/order-quote-destination';
import { createClient } from '@/lib/supabase/server';

describe('POST /api/orders/reuse selected quote validation', () => {
  const mockRpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnrichShippingAddressWithQuoteDestination.mockImplementation(
      async (_supabase, _quoteId, shippingAddress) => shippingAddress
    );
    vi.mocked(cookies).mockResolvedValue({} as never);
    vi.mocked(checkCsrfProtection).mockResolvedValue({ valid: true });
    vi.mocked(createClient).mockReturnValue({
      rpc: mockRpc,
    } as never);
  });

  it('rejects stale selected international quotes before reusing the order', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        shipping_address: {
          address: '123 Queen Street West',
          city: 'Toronto',
          state: 'Ontario',
        },
        shipping_fee: 10_000,
        order_items: [{ name: 'Phone', quantity: 1, price: 100_000 }],
      },
      error: null,
    });
    mockEnrichShippingAddressWithQuoteDestination.mockRejectedValue(
      new OrderQuoteDestinationMismatchError()
    );

    const response = await POST(
      new NextRequest('http://localhost/api/orders/reuse', {
        method: 'POST',
        body: JSON.stringify({
          order_id: '4dc0ee52-d9c4-406a-b6ca-80c84eef6a8f',
          merchant_id: 'e6e2e46c-5e3c-40c1-b0ae-832d6d20f0a2',
          tracking_token: 'tracking-token-123',
          customer_email: 'john@example.com',
          payment_method: 'card',
          shipping_provider: 'GIGL',
          selected_quote_id: '11111111-1111-4111-8111-111111111111',
        }),
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error:
        'The saved international shipping quote no longer matches this checkout. Please get a new quote before checkout.',
      code: 'INTERNATIONAL_QUOTE_ORDER_MISMATCH',
    });
    expect(mockRpc).toHaveBeenCalledOnce();
    expect(mockRpc).toHaveBeenCalledWith(
      'get_storefront_order_quote_validation_context',
      expect.objectContaining({
        p_selected_quote_id: '11111111-1111-4111-8111-111111111111',
      })
    );
  });
});
