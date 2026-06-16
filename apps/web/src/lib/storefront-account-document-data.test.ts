import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  getCurrentDocumentKind,
  getStorefrontAccountDocumentData,
  isReceiptEligible,
  normalizePaymentStatus,
  normalizeShippingStatus,
} from '@/lib/storefront-account-document-data';

function createSupabaseMock(options?: {
  merchantResult?: {
    data: { id: string; slug: string } | null;
    error: unknown;
  };
  customerResult?: { data: { id: string } | null; error: unknown };
}) {
  const merchantQuery = {
    select: () => merchantQuery,
    eq: () => merchantQuery,
    maybeSingle: async () =>
      options?.merchantResult ?? {
        data: { id: 'merchant-1', slug: 'ogabassey' },
        error: null,
      },
  };
  const customerQuery = {
    select: () => customerQuery,
    eq: () => customerQuery,
    maybeSingle: async () =>
      options?.customerResult ?? {
        data: { id: 'customer-1' },
        error: null,
      },
  };

  return {
    from(table: string) {
      if (table === 'merchants') {
        return merchantQuery;
      }

      if (table === 'customers') {
        return customerQuery;
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient;
}

function createFullSupabaseMock(options?: {
  canCancelResult?: { data: unknown; error: unknown };
}) {
  type QueryResult = { data: unknown; error: unknown };

  const rpc = vi.fn((fn: string) => {
    if (fn === 'customer_order_can_cancel') {
      return Promise.resolve(
        options?.canCancelResult ?? { data: true, error: null }
      );
    }
    return Promise.reject(new Error(`Unexpected rpc: ${fn}`));
  });

  // The supabase query builder is a real thenable: awaiting it resolves to the
  // result, and the terminal methods do too. Building it from a Promise keeps
  // the chain awaitable without hand-rolling a `then` property.
  function tableQuery(result: QueryResult) {
    const query = Object.assign(Promise.resolve(result), {
      select: () => query,
      eq: () => query,
      order: () => query,
      limit: () => Promise.resolve(result),
      maybeSingle: () => Promise.resolve(result),
    });
    return query;
  }

  const order = {
    id: 'order-1',
    order_number: 'ORD-1001',
    created_at: '2026-03-22T10:00:00.000Z',
    updated_at: null,
    payment_status: 'unpaid',
    shipping_status: 'processing',
    currency: 'NGN',
    total: 100000,
    subtotal: 100000,
    shipping_fee: 0,
    tax_amount: 0,
    discount_amount: 0,
    amount_paid: 0,
    shipping_address: null,
    customer_name: null,
    customer_email: null,
    customer_phone: null,
    payment_method: 'bank_transfer',
    is_credit_order: false,
    tracking_number: null,
    shipping_provider: null,
    notes: null,
    invoice_type_code: '380',
    invoice_issue_date: null,
    tax_point_date: null,
    payment_due_date: null,
    buyer_reference: null,
    purchase_order_reference: null,
    tax_exclusive_amount: 100000,
    tax_inclusive_amount: 100000,
    invoice_note: null,
    firs_irn: null,
    firs_csid: null,
    firs_qr_code: null,
    payment_terms: null,
  };

  const supabase = {
    rpc,
    from(table: string) {
      switch (table) {
        case 'merchants':
          return tableQuery({
            data: {
              business_name: 'Ogabassey',
              logo_url: null,
              email: null,
              phone: null,
              support_email: null,
              support_phone: null,
              business_address: null,
              cac_rc_number: null,
              tax_identification_number: null,
              legal_entity_name: null,
              brand_colors: null,
              vat_registration_status: 'unregistered',
              vat_rate: 0,
              bank_code: null,
              bank_account_number: null,
              bank_name: null,
              bank_account_name: null,
              social_media: null,
              pages: null,
              registered_address: null,
              id: 'merchant-1',
              slug: 'ogabassey',
            },
            error: null,
          });
        case 'customers':
          return tableQuery({ data: { id: 'customer-1' }, error: null });
        case 'orders':
          return tableQuery({ data: order, error: null });
        case 'order_items':
          return tableQuery({ data: [], error: null });
        case 'transactions':
          return tableQuery({ data: [], error: null });
        case 'order_payment_accounts':
          return tableQuery({ data: [], error: null });
        case 'order_tax_subtotals':
          return tableQuery({ data: [], error: null });
        default:
          throw new Error(`Unexpected table: ${table}`);
      }
    },
  } as unknown as SupabaseClient & { rpc: typeof rpc };

  return { supabase, rpc };
}

describe('storefront account document status helpers', () => {
  it('normalizes payment and shipping statuses to lowercase tokens', () => {
    expect(normalizePaymentStatus('PAID')).toBe('paid');
    expect(normalizePaymentStatus('Partially_Paid')).toBe('partially_paid');
    expect(normalizeShippingStatus('Shipped')).toBe('shipped');
    expect(normalizeShippingStatus('DELIVERED')).toBe('delivered');
  });

  it('returns empty strings for missing statuses and normalizes unknown values', () => {
    expect(normalizePaymentStatus(undefined)).toBe('');
    expect(normalizePaymentStatus(null)).toBe('');
    expect(normalizePaymentStatus('   ')).toBe('');
    expect(normalizeShippingStatus(undefined)).toBe('');
    expect(normalizeShippingStatus(null)).toBe('');
    expect(normalizeShippingStatus('Ready For Pickup')).toBe(
      'ready_for_pickup'
    );
  });

  it('marks imported paid orders as receipt-eligible even without shipped status', () => {
    expect(
      isReceiptEligible({
        paymentStatus: 'paid',
        shippingStatus: 'shipped',
      })
    ).toBe(true);

    expect(
      isReceiptEligible({
        paymentStatus: 'paid',
        shippingStatus: 'delivered',
      })
    ).toBe(true);

    expect(
      isReceiptEligible({
        paymentStatus: 'paid',
        shippingStatus: 'processing',
        externalSource: 'bumpa',
      })
    ).toBe(true);

    expect(
      isReceiptEligible({
        paymentStatus: 'paid',
        shippingStatus: '',
        importJobId: 'job-1',
      })
    ).toBe(true);

    expect(
      isReceiptEligible({
        paymentStatus: 'paid',
        shippingStatus: 'processing',
      })
    ).toBe(false);

    expect(
      isReceiptEligible({
        paymentStatus: 'partially_paid',
        shippingStatus: 'shipped',
      })
    ).toBe(false);

    expect(
      isReceiptEligible({
        paymentStatus: '',
        shippingStatus: 'delivered',
      })
    ).toBe(false);

    expect(
      isReceiptEligible({
        paymentStatus: 'paid',
        shippingStatus: undefined,
      })
    ).toBe(false);

    expect(
      isReceiptEligible({
        paymentStatus: 'paid',
        shippingStatus: 'cancelled',
      })
    ).toBe(false);

    expect(
      isReceiptEligible({
        paymentStatus: 'paid',
        shippingStatus: 'returned',
      })
    ).toBe(false);

    expect(
      isReceiptEligible({
        paymentStatus: '',
        shippingStatus: '',
      })
    ).toBe(false);

    expect(
      isReceiptEligible({
        paymentStatus: '!'.repeat(120),
        shippingStatus: '@'.repeat(120),
      })
    ).toBe(false);
  });

  it('returns the current document kind from normalized status values', () => {
    expect(
      getCurrentDocumentKind({
        paymentStatus: 'PAID',
        shippingStatus: 'DELIVERED',
      })
    ).toBe('receipt');
    expect(
      getCurrentDocumentKind({
        paymentStatus: 'paid',
        shippingStatus: 'shipped',
      })
    ).toBe('receipt');

    expect(
      getCurrentDocumentKind({
        paymentStatus: 'paid',
        shippingStatus: 'processing',
      })
    ).toBe('invoice');

    expect(
      getCurrentDocumentKind({
        paymentStatus: 'paid',
        shippingStatus: 'processing',
        externalSource: 'bumpa',
      })
    ).toBe('receipt');
    expect(
      getCurrentDocumentKind({
        paymentStatus: 'paid',
        shippingStatus: 'processing',
        importJobId: 'job-1',
      })
    ).toBe('receipt');

    expect(
      getCurrentDocumentKind({
        paymentStatus: 'partially_paid',
        shippingStatus: 'shipped',
      })
    ).toBe('invoice');

    expect(
      getCurrentDocumentKind({
        paymentStatus: '',
        shippingStatus: '',
      })
    ).toBe('invoice');

    expect(
      getCurrentDocumentKind({
        paymentStatus: 'paid',
        shippingStatus: 'cancelled',
      })
    ).toBe('invoice');

    expect(
      getCurrentDocumentKind({
        paymentStatus: 'paid',
        shippingStatus: 'pending',
      })
    ).toBe('invoice');

    expect(
      getCurrentDocumentKind({
        paymentStatus: '!'.repeat(120),
        shippingStatus: '@'.repeat(120),
      })
    ).toBe('invoice');
  });

  it('throws a store-specific not-found error when the merchant lookup fails', async () => {
    await expect(
      getStorefrontAccountDocumentData({
        supabase: createSupabaseMock({
          merchantResult: {
            data: null,
            error: null,
          },
        }),
        userId: 'user-1',
        merchantSlug: 'ogabassey',
        orderId: 'order-1',
      })
    ).rejects.toMatchObject({
      message: 'Store not found',
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('throws a customer-specific not-found error when the customer lookup fails', async () => {
    await expect(
      getStorefrontAccountDocumentData({
        supabase: createSupabaseMock({
          customerResult: {
            data: null,
            error: null,
          },
        }),
        userId: 'user-1',
        merchantSlug: 'ogabassey',
        orderId: 'order-1',
      })
    ).rejects.toMatchObject({
      message: 'Customer not found',
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('surfaces can_cancel from the customer_order_can_cancel RPC', async () => {
    const { supabase, rpc } = createFullSupabaseMock({
      canCancelResult: { data: true, error: null },
    });

    const result = await getStorefrontAccountDocumentData({
      supabase,
      userId: 'user-1',
      merchantSlug: 'ogabassey',
      orderId: 'order-1',
    });

    expect(rpc).toHaveBeenCalledWith('customer_order_can_cancel', {
      p_order_id: 'order-1',
    });
    expect(result.order.can_cancel).toBe(true);
  });

  it('defaults can_cancel to false when the RPC returns false', async () => {
    const { supabase } = createFullSupabaseMock({
      canCancelResult: { data: false, error: null },
    });

    const result = await getStorefrontAccountDocumentData({
      supabase,
      userId: 'user-1',
      merchantSlug: 'ogabassey',
      orderId: 'order-1',
    });

    expect(result.order.can_cancel).toBe(false);
  });

  it('treats an RPC error as not cancellable (fail-closed)', async () => {
    const { supabase } = createFullSupabaseMock({
      canCancelResult: { data: null, error: { message: 'rpc failed' } },
    });

    const result = await getStorefrontAccountDocumentData({
      supabase,
      userId: 'user-1',
      merchantSlug: 'ogabassey',
      orderId: 'order-1',
    });

    expect(result.order.can_cancel).toBe(false);
  });
});
