import { beforeEach, describe, expect, it, vi } from 'vitest';
import { captureOrder, createOrder, getOrder } from './paypal-orders';

const OAUTH_RESPONSE = {
  ok: true,
  json: async () => ({
    scope: 'all',
    access_token: 'A21_mock_token',
    token_type: 'Bearer',
    expires_in: 3600,
  }),
} as Response;

describe('createOrder', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('successfully creates an order with a supported presentment currency', async () => {
    const mockFetch = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(OAUTH_RESPONSE)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'PP_ORDER_999',
          status: 'CREATED',
          links: [
            {
              href: 'https://api-m.sandbox.paypal.com/approve/PP_ORDER_999',
              rel: 'approve',
              method: 'GET',
            },
          ],
        }),
      } as Response);

    const result = await createOrder(
      'client123',
      'secret123',
      100,
      'USD',
      'ref_code',
      'sandbox',
      {
        returnUrl: 'https://store.example/checkout?paypal_return=1',
        cancelUrl: 'https://store.example/checkout?paypal_cancel=1',
      }
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('PP_ORDER_999');
      expect(result.data.approveUrl).toBe(
        'https://api-m.sandbox.paypal.com/approve/PP_ORDER_999'
      );
    }

    const createOrderCall = mockFetch.mock.calls.at(-1);
    expect(createOrderCall?.[0]).toBe(
      'https://api-m.sandbox.paypal.com/v2/checkout/orders'
    );
    const createOrderBody = JSON.parse(
      (createOrderCall?.[1] as RequestInit)?.body as string
    );
    expect(createOrderBody.purchase_units[0].amount).toEqual({
      currency_code: 'USD',
      value: '100.00',
    });
    expect(
      createOrderBody.payment_source.paypal.experience_context.return_url
    ).toBe('https://store.example/checkout?paypal_return=1');
    expect(
      createOrderBody.payment_source.paypal.experience_context.user_action
    ).toBe('PAY_NOW');
  });

  it('rejects an unsupported presentment currency instead of applying an internal fallback rate', async () => {
    const mockFetch = vi.spyOn(global, 'fetch');

    const result = await createOrder(
      'client123',
      'secret123',
      1300,
      'NGN',
      'ref_code',
      'sandbox'
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('UNSUPPORTED_CURRENCY');
    }
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('propagates an OAuth failure without attempting order creation', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error_description: 'Client Authentication failed' }),
    } as Response);

    const result = await createOrder(
      'client123',
      'secret123',
      100,
      'USD',
      'ref_code',
      'sandbox'
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('HTTP_401');
    }
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns a failure when order creation itself is rejected', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(OAUTH_RESPONSE)
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ message: 'Invalid purchase unit' }),
      } as Response);

    const result = await createOrder(
      'client123',
      'secret123',
      100,
      'USD',
      'ref_code',
      'sandbox'
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('HTTP_422');
      expect(result.error).toBe('Invalid purchase unit');
    }
  });
});

describe('captureOrder', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('successfully captures an approved order', async () => {
    const mockFetch = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(OAUTH_RESPONSE)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'PP_ORDER_999',
          status: 'COMPLETED',
          purchase_units: [
            {
              payments: {
                captures: [
                  {
                    id: 'CAPTURE_111',
                    status: 'COMPLETED',
                    amount: { currency_code: 'USD', value: '1.00' },
                  },
                ],
              },
            },
          ],
          links: [
            {
              href: 'https://api-m.sandbox.paypal.com/v2/checkout/orders/PP_ORDER_999',
              rel: 'self',
              method: 'GET',
            },
          ],
        }),
      } as Response);

    const result = await captureOrder(
      'client123',
      'secret123',
      'PP_ORDER_999',
      'sandbox',
      'capture-request-1'
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('COMPLETED');
      expect(result.data.purchase_units[0].payments.captures[0].id).toBe(
        'CAPTURE_111'
      );
      expect(result.data.links?.[0]?.href).toContain(
        'api-m.sandbox.paypal.com'
      );
    }
    expect(mockFetch).toHaveBeenLastCalledWith(
      'https://api-m.sandbox.paypal.com/v2/checkout/orders/PP_ORDER_999/capture',
      expect.objectContaining({
        headers: expect.objectContaining({
          'PayPal-Request-Id': 'capture-request-1',
        }),
      })
    );
  });

  it('returns SCHEMA_MISMATCH when the capture body is missing purchase_units.payments', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(OAUTH_RESPONSE)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'PP_ORDER_999',
          status: 'COMPLETED',
          purchase_units: [{}],
        }),
      } as Response);

    const result = await captureOrder(
      'client123',
      'secret123',
      'PP_ORDER_999',
      'sandbox'
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('SCHEMA_MISMATCH');
    }
  });

  it('returns a failure when PayPal rejects the capture request', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(OAUTH_RESPONSE)
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ message: 'ORDER_NOT_APPROVED' }),
      } as Response);

    const result = await captureOrder(
      'client123',
      'secret123',
      'PP_ORDER_999',
      'sandbox'
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('HTTP_422');
      expect(result.error).toBe('ORDER_NOT_APPROVED');
    }
  });
});

describe('getOrder', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches an order by id', async () => {
    const mockFetch = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(OAUTH_RESPONSE)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'PP_ORDER_999',
          status: 'APPROVED',
          links: [
            {
              href: 'https://api-m.paypal.com/v2/checkout/orders/PP_ORDER_999',
              rel: 'self',
              method: 'GET',
            },
          ],
        }),
      } as Response);

    const result = await getOrder(
      'client123',
      'secret123',
      'PP_ORDER_999',
      'live'
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('APPROVED');
    }
    expect(mockFetch).toHaveBeenLastCalledWith(
      'https://api-m.paypal.com/v2/checkout/orders/PP_ORDER_999',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('returns a failure when the order cannot be found', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(OAUTH_RESPONSE)
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ message: 'RESOURCE_NOT_FOUND' }),
      } as Response);

    const result = await getOrder(
      'client123',
      'secret123',
      'missing-id',
      'sandbox'
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe('HTTP_404');
    }
  });
});
