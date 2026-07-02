import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  buildCustomerInsert,
  buildCustomerMaps,
  findExistingCustomerByEmail,
  isCustomerEmailConstraintError,
  rememberCustomer,
  reuseEmailCustomer,
} from './resolve-import-customer-helpers';

type ImportedOrder = Parameters<typeof buildCustomerInsert>[1];

function createOrder(email = 'ada@example.com') {
  return {
    customer: {
      fullName: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email,
      phone: '+2347000000000',
    },
  } as ImportedOrder;
}

function createEmailLookupQuery(responses: unknown[]) {
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
  for (const response of responses) {
    query.limit.mockResolvedValueOnce(response);
  }
  return query;
}

describe('resolve import customer helpers', () => {
  it('indexes and remembers customers by normalized email and phone', () => {
    const customer = {
      id: 'customer-1',
      email: 'Ada@Example.com',
      phone: '+234 700 000 0000',
      user_id: null,
    };
    const maps = buildCustomerMaps([customer]);

    expect(maps.customersByEmail.get('ada@example.com')).toBe(customer);
    expect(maps.customersByPhone.get('+2347000000000')).toEqual([customer]);

    rememberCustomer(maps, { ...customer });

    expect(maps.customersByPhone.get('+2347000000000')).toHaveLength(1);
  });

  it('replaces remembered phone entries when the customer record changes', () => {
    const customer = {
      id: 'customer-1',
      email: null,
      phone: '+2347000000000',
      user_id: null,
    };
    const maps = buildCustomerMaps([customer]);

    rememberCustomer(maps, { ...customer, email: 'ada@example.com' });

    expect(maps.customersByPhone.get('+2347000000000')).toEqual([
      expect.objectContaining({ email: 'ada@example.com' }),
    ]);
  });

  it('detects supported customer email unique constraints', () => {
    expect(
      isCustomerEmailConstraintError({
        code: '23505',
        message:
          'duplicate key value violates unique constraint "customers_merchant_id_email_key"',
      })
    ).toBe(true);
    expect(
      isCustomerEmailConstraintError({
        code: '23505',
        message:
          'duplicate key value violates unique constraint "customers_merchant_phone_unique"',
      })
    ).toBe(false);
  });

  it('finds an active customer by normalized email', async () => {
    const query = createEmailLookupQuery([
      {
        data: [
          {
            id: 'customer-1',
            email: 'Ada@Example.com',
            phone: null,
            user_id: null,
            deleted_at: null,
          },
        ],
        error: null,
      },
    ]);
    const supabase = {
      from: vi.fn().mockReturnValue(query),
    } as unknown as SupabaseClient;

    await expect(
      findExistingCustomerByEmail(supabase, 'merchant-1', 'ada@example.com')
    ).resolves.toEqual(expect.objectContaining({ id: 'customer-1' }));
  });

  it('surfaces active email lookup query errors', async () => {
    const query = createEmailLookupQuery([
      { data: null, error: { message: 'lookup failed' } },
    ]);
    const supabase = {
      from: vi.fn().mockReturnValue(query),
    } as unknown as SupabaseClient;

    await expect(
      findExistingCustomerByEmail(supabase, 'merchant-1', 'ada@example.com')
    ).rejects.toThrow(
      'Failed to resolve conflicting customer by email: lookup failed'
    );
  });

  it('surfaces deleted-customer email conflicts clearly', async () => {
    const query = createEmailLookupQuery([
      { data: [], error: null },
      {
        data: [
          {
            id: 'customer-deleted',
            email: 'ada@example.com',
            phone: null,
            user_id: null,
            deleted_at: '2026-01-01T00:00:00.000Z',
          },
        ],
        error: null,
      },
    ]);
    const supabase = {
      from: vi.fn().mockReturnValue(query),
    } as unknown as SupabaseClient;

    await expect(
      findExistingCustomerByEmail(supabase, 'merchant-1', 'ada@example.com')
    ).rejects.toThrow('Email is already used by a deleted customer record');
  });

  it('remembers a reused email customer', async () => {
    const maps = buildCustomerMaps([]);
    const query = createEmailLookupQuery([
      {
        data: [
          {
            id: 'customer-existing',
            email: 'ada@example.com',
            phone: '+2347000000000',
            user_id: null,
            deleted_at: null,
          },
        ],
        error: null,
      },
    ]);
    const supabase = {
      from: vi.fn().mockReturnValue(query),
    } as unknown as SupabaseClient;

    await expect(
      reuseEmailCustomer(supabase, 'merchant-1', 'ada@example.com', maps)
    ).resolves.toEqual({
      customerId: 'customer-existing',
      createdCustomer: false,
    });
    expect(maps.customersByEmail.get('ada@example.com')?.id).toBe(
      'customer-existing'
    );
  });

  it('surfaces reused email customer lookup errors', async () => {
    const maps = buildCustomerMaps([]);
    const query = createEmailLookupQuery([
      { data: null, error: { message: 'reuse lookup failed' } },
    ]);
    const supabase = {
      from: vi.fn().mockReturnValue(query),
    } as unknown as SupabaseClient;

    await expect(
      reuseEmailCustomer(supabase, 'merchant-1', 'ada@example.com', maps)
    ).rejects.toThrow(
      'Failed to resolve conflicting customer by email: reuse lookup failed'
    );
  });

  it('builds a scoped customer insert payload', () => {
    expect(buildCustomerInsert('merchant-1', createOrder(), null)).toEqual({
      merchant_id: 'merchant-1',
      email: 'ada@example.com',
      phone: null,
      full_name: 'Ada Lovelace',
      first_name: 'Ada',
      last_name: 'Lovelace',
    });
  });
});
