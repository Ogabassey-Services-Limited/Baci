import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  createImportCustomerResolver,
  type ImportCustomerResolver,
} from '@/lib/import-commit/resolve-import-customer';

type ImportResolverOrder = Parameters<
  ImportCustomerResolver['resolveCustomerId']
>[1];

function createOrder() {
  return {
    customer: {
      fullName: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: '+2347000000000',
    },
  } as unknown as ImportResolverOrder;
}

function createLoadQuery(data: unknown[]) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.is.mockResolvedValue({ data, error: null });
  return query;
}

function createUpdateQuery(data: unknown, error: unknown = null) {
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
  query.maybeSingle.mockResolvedValue({ data, error });
  return query;
}

function createInsertQuery() {
  const query = {
    insert: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
  };
  query.insert.mockReturnValue(query);
  query.select.mockReturnValue(query);
  return query;
}

describe('createImportCustomerResolver merge behavior', () => {
  it('enriches a phone-only customer with an imported email', async () => {
    const loadQuery = createLoadQuery([
      {
        id: 'customer-phone-only',
        email: null,
        phone: '+2347000000000',
        user_id: null,
      },
    ]);
    const updateQuery = createUpdateQuery({
      id: 'customer-phone-only',
      email: 'ada@example.com',
      phone: '+2347000000000',
      user_id: null,
    });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(loadQuery)
        .mockReturnValueOnce(updateQuery),
    } as unknown as SupabaseClient;

    const resolver = await createImportCustomerResolver(supabase, 'merchant-1');
    const result = await resolver.resolveCustomerId(supabase, createOrder());

    expect(result).toEqual({
      customerId: 'customer-phone-only',
      createdCustomer: false,
    });
    expect(updateQuery.update).toHaveBeenCalledWith({
      email: 'ada@example.com',
    });
    expect(updateQuery.is).toHaveBeenCalledWith('email', null);
  });

  it('reuses a customer enriched earlier in the same import without another update', async () => {
    const loadQuery = createLoadQuery([
      {
        id: 'customer-phone-only',
        email: null,
        phone: '+2347000000000',
        user_id: null,
      },
    ]);
    const updateQuery = createUpdateQuery({
      id: 'customer-phone-only',
      email: 'ada@example.com',
      phone: '+2347000000000',
      user_id: null,
    });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(loadQuery)
        .mockReturnValueOnce(updateQuery),
    } as unknown as SupabaseClient;

    const resolver = await createImportCustomerResolver(supabase, 'merchant-1');
    const firstResult = await resolver.resolveCustomerId(
      supabase,
      createOrder()
    );
    const secondOrder = {
      ...createOrder(),
      customer: {
        ...createOrder().customer,
        email: 'bob@example.com',
      },
    } as ImportResolverOrder;
    const secondResult = await resolver.resolveCustomerId(
      supabase,
      secondOrder
    );

    expect(firstResult).toEqual({
      customerId: 'customer-phone-only',
      createdCustomer: false,
    });
    expect(secondResult).toEqual({
      customerId: 'customer-phone-only',
      createdCustomer: false,
    });
    expect(updateQuery.update).toHaveBeenCalledTimes(1);
  });

  it('does not reuse a pre-existing phone customer with a different email', async () => {
    const loadQuery = createLoadQuery([
      {
        id: 'customer-phone-holder',
        email: 'previous@example.com',
        phone: '+2347000000000',
        user_id: null,
      },
    ]);
    const insertQuery = createInsertQuery();
    insertQuery.single.mockResolvedValue({
      data: {
        id: 'customer-new',
        email: 'ada@example.com',
        phone: null,
        user_id: null,
      },
      error: null,
    });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(loadQuery)
        .mockReturnValueOnce(insertQuery),
    } as unknown as SupabaseClient;

    const resolver = await createImportCustomerResolver(supabase, 'merchant-1');
    const result = await resolver.resolveCustomerId(supabase, createOrder());

    expect(result).toEqual({
      customerId: 'customer-new',
      createdCustomer: true,
    });
    expect(insertQuery.insert).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ada@example.com', phone: null })
    );
  });

  it('reuses an existing email customer when the phone retry hits the email constraint', async () => {
    const loadQuery = createLoadQuery([]);
    const insertQuery = createInsertQuery();
    insertQuery.single
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: '23505',
          message:
            'duplicate key value violates unique constraint "customers_merchant_phone_unique"',
        },
      })
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: '23505',
          message:
            'duplicate key value violates unique constraint "customers_merchant_id_email_key"',
        },
      });

    const emailLookupQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      ilike: vi.fn(),
      is: vi.fn(),
      limit: vi.fn(),
    };
    emailLookupQuery.select.mockReturnValue(emailLookupQuery);
    emailLookupQuery.eq.mockReturnValue(emailLookupQuery);
    emailLookupQuery.ilike.mockReturnValue(emailLookupQuery);
    emailLookupQuery.is.mockReturnValue(emailLookupQuery);
    emailLookupQuery.limit.mockResolvedValue({
      data: [
        {
          id: 'customer-existing',
          email: 'Ada@Example.com',
          phone: null,
          user_id: null,
          deleted_at: null,
        },
      ],
      error: null,
    });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(loadQuery)
        .mockReturnValueOnce(insertQuery)
        .mockReturnValueOnce(insertQuery)
        .mockReturnValueOnce(emailLookupQuery),
    } as unknown as SupabaseClient;

    const resolver = await createImportCustomerResolver(supabase, 'merchant-1');
    const result = await resolver.resolveCustomerId(supabase, createOrder());

    expect(result).toEqual({
      customerId: 'customer-existing',
      createdCustomer: false,
    });
    expect(insertQuery.insert).toHaveBeenLastCalledWith(
      expect.objectContaining({ email: 'ada@example.com', phone: null })
    );
    expect(emailLookupQuery.ilike).toHaveBeenCalledWith(
      'email',
      'ada@example.com'
    );
  });
});
