import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAgenticScopedSupabaseClient: vi.fn(),
}));

vi.mock('@/lib/agentic/scoped-supabase', () => ({
  createAgenticScopedSupabaseClient: mocks.createAgenticScopedSupabaseClient,
}));

import { handleCancelOrder as handleCancelOrderWithMerchant } from './chat-order-cancellation';

const TEST_MERCHANT = {
  id: 'merchant-1',
  slug: 'winter-store',
  businessName: 'Winter Store',
} as const;
const ORDER_ID = '11111111-1111-4111-8111-111111111111';

const handleCancelOrder = (
  params: Parameters<typeof handleCancelOrderWithMerchant>[0]
) => handleCancelOrderWithMerchant(params, TEST_MERCHANT);

type QueryResult = {
  data: unknown;
  error?: unknown;
};

const baseOrder = {
  id: 'order-1',
  order_number: '#00001234',
  customer_email: 'Buyer@Example.com',
  payment_status: 'unpaid',
  shipping_status: 'pending',
};

const cancelledOrder = {
  id: 'order-1',
  order_number: '#00001234',
  payment_status: 'cancelled',
  shipping_status: 'cancelled',
};

function createQueryMock(result: QueryResult = { data: null, error: null }) {
  const query = Object.assign(Promise.resolve(result), {
    select: vi.fn<(...args: unknown[]) => unknown>(),
    eq: vi.fn<(...args: unknown[]) => unknown>(),
    in: vi.fn<(...args: unknown[]) => unknown>(),
    limit: vi.fn<(...args: unknown[]) => unknown>(),
    maybeSingle: vi.fn<() => Promise<QueryResult>>(),
  });

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue(result);

  return query;
}

function mockLookupOnly(result: QueryResult) {
  const lookupQuery = createQueryMock(result);
  const from = vi.fn(() => lookupQuery);
  mocks.createAgenticScopedSupabaseClient.mockReturnValue({ from });
}

function mockLookupThenUpdate(
  lookupResult: QueryResult = { data: [baseOrder], error: null },
  updateResult: QueryResult = { data: cancelledOrder, error: null }
) {
  const lookupQuery = createQueryMock(lookupResult);
  const updateQuery = createQueryMock(updateResult);
  const update = vi.fn(() => updateQuery);
  const from = vi
    .fn()
    .mockReturnValueOnce(lookupQuery)
    .mockReturnValueOnce({ update });
  mocks.createAgenticScopedSupabaseClient.mockReturnValue({ from });
  return { from, lookupQuery, update, updateQuery };
}

describe('handleCancelOrder', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('cancels only a matching Ogabassey order that is unpaid and pending', async () => {
    const { lookupQuery, update, updateQuery } = mockLookupThenUpdate();

    const result = await handleCancelOrder({
      orderNumber: '00001234',
      customerEmail: 'buyer@example.com',
    });

    expect(result).toMatchObject({
      success: true,
      status: 'cancelled',
      orderId: 'order-1',
    });
    expect(lookupQuery.eq).toHaveBeenCalledWith(
      'merchant_id',
      TEST_MERCHANT.id
    );
    expect(lookupQuery.in).toHaveBeenCalledWith('order_number', [
      '00001234',
      '#00001234',
    ]);
    expect(update).toHaveBeenCalledWith({
      payment_status: 'cancelled',
      shipping_status: 'cancelled',
    });
    expect(updateQuery.eq).toHaveBeenCalledWith('id', 'order-1');
    expect(updateQuery.eq).toHaveBeenCalledWith(
      'merchant_id',
      TEST_MERCHANT.id
    );
    expect(updateQuery.eq).toHaveBeenCalledWith(
      'customer_email',
      'Buyer@Example.com'
    );
    expect(updateQuery.in).toHaveBeenCalledWith('payment_status', [
      'pending',
      'unpaid',
    ]);
    expect(updateQuery.in).toHaveBeenCalledWith('shipping_status', ['pending']);
    expect(mocks.createAgenticScopedSupabaseClient).toHaveBeenCalledWith({
      merchantId: TEST_MERCHANT.id,
      merchantSlug: TEST_MERCHANT.slug,
    });
  });

  it('cancels by orderId when no orderNumber is supplied', async () => {
    const { lookupQuery } = mockLookupThenUpdate();

    const result = await handleCancelOrder({
      orderId: ORDER_ID,
      customerEmail: 'buyer@example.com',
    });

    expect(result).toMatchObject({ success: true, status: 'cancelled' });
    expect(lookupQuery.eq).toHaveBeenCalledWith('id', ORDER_ID);
    expect(lookupQuery.in).not.toHaveBeenCalledWith(
      'order_number',
      expect.anything()
    );
  });

  it('applies both lookup filters when orderId and orderNumber are supplied', async () => {
    const { lookupQuery } = mockLookupThenUpdate();

    await handleCancelOrder({
      orderId: ORDER_ID,
      orderNumber: '#00001234',
      customerEmail: 'buyer@example.com',
    });

    expect(lookupQuery.eq).toHaveBeenCalledWith('id', ORDER_ID);
    expect(lookupQuery.in).toHaveBeenCalledWith('order_number', [
      '#00001234',
      '00001234',
    ]);
  });

  it('does not cancel when the order email does not match', async () => {
    mockLookupOnly({
      data: [{ ...baseOrder, customer_email: 'other@example.com' }],
      error: null,
    });

    const result = await handleCancelOrder({
      orderNumber: '#00001234',
      customerEmail: 'buyer@example.com',
    });

    expect(result).toMatchObject({ success: false, status: 'not_found' });
  });

  it('returns already_cancelled when the matched order is already cancelled', async () => {
    mockLookupOnly({
      data: [{ ...baseOrder, payment_status: 'cancelled' }],
      error: null,
    });

    const result = await handleCancelOrder({
      orderNumber: '#00001234',
      customerEmail: 'buyer@example.com',
    });

    expect(result).toMatchObject({
      success: true,
      status: 'already_cancelled',
      orderId: 'order-1',
      paymentStatus: 'cancelled',
    });
  });

  it('returns not_found when the initial lookup errors', async () => {
    mockLookupOnly({ data: null, error: { message: 'lookup failed' } });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await handleCancelOrder({
      orderNumber: '#00001234',
      customerEmail: 'buyer@example.com',
    });

    expect(result).toMatchObject({ success: false, status: 'not_found' });
  });

  it('refuses to cancel paid or fulfilled orders', async () => {
    mockLookupOnly({
      data: [
        {
          ...baseOrder,
          customer_email: 'buyer@example.com',
          payment_status: 'paid',
          shipping_status: 'processing',
        },
      ],
      error: null,
    });

    const result = await handleCancelOrder({
      orderNumber: '#00001234',
      customerEmail: 'buyer@example.com',
    });

    expect(result).toMatchObject({
      success: false,
      status: 'not_cancellable',
      orderId: 'order-1',
      paymentStatus: 'paid',
      shippingStatus: 'processing',
    });
  });

  it('reports update errors from guarded cancellation updates', async () => {
    mockLookupThenUpdate(
      {
        data: [{ ...baseOrder, customer_email: 'buyer@example.com' }],
        error: null,
      },
      { data: null, error: { message: 'update failed' } }
    );
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await handleCancelOrder({
      orderNumber: '#00001234',
      customerEmail: 'buyer@example.com',
    });

    expect(result).toMatchObject({
      success: false,
      status: 'not_cancellable',
      message:
        'I could not cancel this order automatically. Please contact WhatsApp support.',
    });
  });

  it('reports a race when the guarded cancellation update matches no rows', async () => {
    const { lookupQuery } = mockLookupThenUpdate(
      {
        data: [{ ...baseOrder, customer_email: 'buyer@example.com' }],
        error: null,
      },
      { data: null, error: null }
    );

    const result = await handleCancelOrder({
      orderId: ORDER_ID,
      customerEmail: 'buyer@example.com',
    });

    expect(result).toMatchObject({
      success: false,
      status: 'not_cancellable',
      orderId: 'order-1',
      message:
        'This order changed status before I could cancel it. Please contact WhatsApp support.',
    });
    expect(lookupQuery.eq).toHaveBeenCalledWith('id', ORDER_ID);
  });

  it('returns a generic failure response for unexpected exceptions', async () => {
    mocks.createAgenticScopedSupabaseClient.mockImplementation(() => {
      throw new Error('boom');
    });
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const result = await handleCancelOrder({
      orderNumber: '#00001234',
      customerEmail: 'buyer@example.com',
    });

    expect(result).toEqual({
      success: false,
      status: 'not_found',
      message:
        'I could not cancel that order right now. Please contact WhatsApp support.',
    });
    expect(errorSpy).toHaveBeenCalledWith(
      '[Chat Tools] Cancel order error:',
      expect.any(Error)
    );
  });
});
