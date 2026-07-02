import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { enrichPhoneCustomerEmail } from './resolve-import-customer-helpers';

type ImportedOrder = Parameters<typeof enrichPhoneCustomerEmail>[3];

function createOrder() {
  return {
    customer: {
      fullName: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: '+2347000000000',
    },
  } as ImportedOrder;
}

function createEnrichmentUpdateQuery(response: unknown) {
  const query = {
    update: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue(response);
  return query;
}

function createEmailLookupQuery(data: unknown[]) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    ilike: vi.fn(),
    is: vi.fn(),
    limit: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.ilike.mockReturnValue(query);
  query.is.mockReturnValue(query);
  query.limit.mockResolvedValue({ data, error: null });
  return query;
}

describe('enrichPhoneCustomerEmail', () => {
  it('does not enrich a phone customer that already has an email', async () => {
    const supabase = { from: vi.fn() } as unknown as SupabaseClient;
    const customer = {
      id: 'customer-1',
      email: 'existing@example.com',
      phone: '+2347000000000',
      user_id: null,
    };

    await expect(
      enrichPhoneCustomerEmail(supabase, 'merchant-1', customer, createOrder())
    ).resolves.toBe(customer);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('reuses an email customer when phone enrichment hits an email constraint', async () => {
    const updateQuery = createEnrichmentUpdateQuery({
      data: null,
      error: {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "customers_merchant_id_email_key"',
      },
    });
    const emailLookupQuery = createEmailLookupQuery([
      {
        id: 'customer-email',
        email: 'ada@example.com',
        phone: null,
        user_id: null,
        deleted_at: null,
      },
    ]);
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(updateQuery)
        .mockReturnValueOnce(emailLookupQuery),
    } as unknown as SupabaseClient;

    await expect(
      enrichPhoneCustomerEmail(
        supabase,
        'merchant-1',
        {
          id: 'customer-phone',
          email: null,
          phone: '+2347000000000',
          user_id: null,
        },
        createOrder()
      )
    ).resolves.toEqual(expect.objectContaining({ id: 'customer-email' }));
  });

  it('reloads the phone customer when a concurrent claim fills email first', async () => {
    const updateQuery = createEnrichmentUpdateQuery({
      data: null,
      error: null,
    });
    const reloadQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      maybeSingle: vi.fn(),
    };
    reloadQuery.select.mockReturnValue(reloadQuery);
    reloadQuery.eq.mockReturnValue(reloadQuery);
    reloadQuery.is.mockReturnValue(reloadQuery);
    reloadQuery.maybeSingle.mockResolvedValue({
      data: {
        id: 'customer-phone',
        email: 'claimed@example.com',
        phone: '+2347000000000',
        user_id: null,
      },
      error: null,
    });
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(updateQuery)
        .mockReturnValueOnce(reloadQuery),
    } as unknown as SupabaseClient;

    await expect(
      enrichPhoneCustomerEmail(
        supabase,
        'merchant-1',
        {
          id: 'customer-phone',
          email: null,
          phone: '+2347000000000',
          user_id: null,
        },
        createOrder()
      )
    ).resolves.toEqual(
      expect.objectContaining({ email: 'claimed@example.com' })
    );
  });
});
