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

vi.mock('@/lib/shipping/order-quote-destination', () => ({
  enrichShippingAddressWithQuoteDestination:
    mockEnrichShippingAddressWithQuoteDestination,
  OrderQuoteDestinationMismatchError: class extends Error {},
}));

import { cookies } from 'next/headers';
import { checkCsrfProtection } from '@/lib/csrf';
import { createClient } from '@/lib/supabase/server';

describe('POST /api/orders/reuse quote address persistence', () => {
  const mockRpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cookies).mockResolvedValue({} as never);
    vi.mocked(checkCsrfProtection).mockResolvedValue({ valid: true });
    vi.mocked(createClient).mockReturnValue({
      rpc: mockRpc,
    } as never);
  });

  it('passes the quote-enriched address to the reuse checkout RPC', async () => {
    const enrichedAddress = {
      address: '123 Queen Street West',
      city: 'Toronto',
      country: 'Canada',
      countryCode: 'CA',
      postalCode: 'M5H 2N2',
      state: 'Ontario',
    };
    mockEnrichShippingAddressWithQuoteDestination.mockResolvedValue(
      enrichedAddress
    );
    mockRpc
      .mockResolvedValueOnce({
        data: {
          order_items: [{ name: 'Phone', quantity: 1 }],
          selected_quote_id: '11111111-1111-4111-8111-111111111111',
          shipping_address: {
            address: '123 Queen Street West',
            city: 'Toronto',
            state: 'Ontario',
          },
          shipping_fee: 10_000,
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'order-123',
          order_number: 'ORD-123',
        },
        error: null,
      });

    const response = await POST(
      new NextRequest('http://localhost/api/orders/reuse', {
        method: 'POST',
        body: JSON.stringify({
          customer_email: 'john@example.com',
          merchant_id: 'e6e2e46c-5e3c-40c1-b0ae-832d6d20f0a2',
          order_id: '4dc0ee52-d9c4-406a-b6ca-80c84eef6a8f',
          payment_method: 'card',
          selected_quote_id: '11111111-1111-4111-8111-111111111111',
          shipping_provider: 'GIGL',
          tracking_token: 'tracking-token-123',
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenNthCalledWith(
      2,
      'prepare_storefront_order_for_checkout',
      expect.objectContaining({
        p_shipping_address: enrichedAddress,
      })
    );
  });
});
