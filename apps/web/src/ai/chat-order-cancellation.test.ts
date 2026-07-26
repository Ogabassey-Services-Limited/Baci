import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAgenticScopedSupabaseClient: vi.fn(),
  createAnonClient: vi.fn(),
}));

vi.mock('@/lib/agentic/scoped-supabase', () => ({
  createAgenticScopedSupabaseClient: mocks.createAgenticScopedSupabaseClient,
}));

// The tenant is resolved slug -> id on a plain anon client before the scoped
// client is built, so this factory must be mocked or cancellation fails closed.
vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: mocks.createAnonClient,
}));

import { resetAgenticMerchantIdCache } from '@/lib/agentic/agentic-merchant-id';
import { handleCancelOrder } from './chat-order-cancellation';

const OGABASSEY_MERCHANT_ID = '3bc72679-c0f7-4db4-9054-6a4a4a95a498';
const ORDER_ID = '11111111-1111-4111-8111-111111111111';

function mockTenantLookup(merchantId: string | null) {
  const maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: merchantId ? { id: merchantId } : null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  mocks.createAnonClient.mockReturnValue({ from: vi.fn(() => ({ select })) });
}

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
    vi.unstubAllEnvs();
    resetAgenticMerchantIdCache();
    vi.stubEnv('BACI_AGENTIC_MERCHANT_SLUG', 'ogabassey');
    mockTenantLookup(OGABASSEY_MERCHANT_ID);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetAgenticMerchantIdCache();
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
      OGABASSEY_MERCHANT_ID
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
      OGABASSEY_MERCHANT_ID
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
      merchantId: OGABASSEY_MERCHANT_ID,
      merchantSlug: 'ogabassey',
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

  it('fails closed without building a scoped client when the copilot tenant is unresolvable', async () => {
    // Arrange: no BACI_AGENTIC_MERCHANT_SLUG configured
    vi.unstubAllEnvs();
    resetAgenticMerchantIdCache();
    mockLookupThenUpdate();

    // Act
    const result = await handleCancelOrder({
      orderNumber: '#00001234',
      customerEmail: 'buyer@example.com',
    });

    // Assert: never widen the cancellation scope to an unknown merchant.
    expect(result).toMatchObject({ success: false, status: 'not_found' });
    expect(mocks.createAgenticScopedSupabaseClient).not.toHaveBeenCalled();
  });
});
