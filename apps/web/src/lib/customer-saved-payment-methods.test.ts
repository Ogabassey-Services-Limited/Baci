import { describe, expect, it, vi } from 'vitest';
import {
  formatSavedPaymentMethodLabel,
  listSavedPaymentMethods,
  upsertPaystackAuthorization,
} from '@/lib/customer-saved-payment-methods';

describe('formatSavedPaymentMethodLabel', () => {
  it('prefers bank and last4 details when available', () => {
    expect(
      formatSavedPaymentMethodLabel({
        bank: 'Access Bank',
        brand: 'visa',
        card_type: 'visa DEBIT',
        last4: '1234',
      })
    ).toBe('Access Bank ending 1234');
  });

  it('falls back to a generic card label', () => {
    expect(
      formatSavedPaymentMethodLabel({
        bank: null,
        brand: null,
        card_type: null,
        last4: null,
      })
    ).toBe('Card');
  });
});

describe('listSavedPaymentMethods', () => {
  it('maps saved card rows into display-friendly records', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'card-1',
          provider: 'paystack',
          brand: 'visa',
          bank: 'Access Bank',
          card_type: 'visa DEBIT',
          last4: '1234',
          exp_month: '08',
          exp_year: '2030',
          is_default: true,
        },
      ],
      error: null,
    });

    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  order,
                }),
              }),
            }),
          }),
        }),
      })),
    } as unknown as Parameters<typeof listSavedPaymentMethods>[0]['supabase'];

    const result = await listSavedPaymentMethods({
      supabase,
      merchantId: 'merchant-1',
      customerId: 'customer-1',
    });

    expect(result).toEqual([
      expect.objectContaining({
        id: 'card-1',
        label: 'Access Bank ending 1234',
        is_default: true,
      }),
    ]);
  });
});

describe('upsertPaystackAuthorization', () => {
  it('returns null for non-reusable authorizations', async () => {
    const supabase = {} as Parameters<
      typeof upsertPaystackAuthorization
    >[0]['supabase'];

    const result = await upsertPaystackAuthorization({
      supabase,
      merchantId: 'merchant-1',
      customerId: 'customer-1',
      customerEmail: 'customer@example.com',
      authorization: {
        authorization_code: '',
        card_type: 'visa',
        last4: '1234',
        exp_month: '08',
        exp_year: '2030',
        bank: 'Access Bank',
        channel: 'card',
        signature: null,
        reusable: false,
        country_code: 'NG',
      },
    });

    expect(result).toBeNull();
  });

  it('stores the reusable authorization and returns its id', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: 'card-1' },
      error: null,
    });
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
    const upsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single,
      }),
    });

    const supabase = {
      from: vi.fn(() => ({
        update,
        upsert,
      })),
    } as unknown as Parameters<
      typeof upsertPaystackAuthorization
    >[0]['supabase'];

    const result = await upsertPaystackAuthorization({
      supabase,
      merchantId: 'merchant-1',
      customerId: 'customer-1',
      customerEmail: 'customer@example.com',
      authorization: {
        authorization_code: 'AUTH_123',
        card_type: 'visa DEBIT',
        last4: '1234',
        exp_month: '08',
        exp_year: '2030',
        bank: 'Access Bank',
        channel: 'card',
        signature: 'SIG_123',
        reusable: true,
        country_code: 'NG',
        brand: 'visa',
      },
    });

    expect(result).toBe('card-1');
    expect(update).toHaveBeenCalled();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        authorization_code: 'AUTH_123',
        authorization_signature: 'SIG_123',
        is_default: true,
      }),
      { onConflict: 'customer_id,provider,authorization_signature' }
    );
  });
});
