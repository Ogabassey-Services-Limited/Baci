import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createImportCustomerResolver,
  type ImportCustomerResolver,
} from '@/lib/import-commit/resolve-import-customer';

type ImportResolverOrder = Parameters<
  ImportCustomerResolver['resolveCustomerId']
>[1];

function createOrder(overrides?: Partial<Record<string, unknown>>) {
  return {
    customer: {
      fullName: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: '+2347000000000',
    },
    ...overrides,
  } as unknown as ImportResolverOrder;
}

function createLoadQuery() {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.is.mockResolvedValue({ data: [], error: null });
  return query;
}

function createEmailConflictInsertQuery(
  constraintName = 'customers_merchant_id_email_key'
) {
  return createInsertQuery({
    data: null,
    error: {
      code: '23505',
      message: `duplicate key value violates unique constraint "${constraintName}"`,
    },
  });
}

function createInsertQuery(response: { data: unknown; error: unknown }) {
  const query = {
    insert: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
  };
  query.insert.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.single.mockResolvedValue(response);
  return query;
}

function toRows(data: unknown) {
  if (Array.isArray(data)) {
    return data;
  }

  return data ? [data] : [];
}

function createActiveLookupQuery(data: unknown) {
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
  query.limit.mockResolvedValue({ data: toRows(data), error: null });
  return query;
}

function createDeletedLookupQuery(data: unknown) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    ilike: vi.fn(),
    limit: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.ilike.mockReturnValue(query);
  query.limit.mockResolvedValue({ data: toRows(data), error: null });
  return query;
}

function existingCustomer(email = 'ada@example.com') {
  return {
    id: 'customer-existing-email',
    email,
    phone: '+2347000000000',
    user_id: null,
  };
}

describe('createImportCustomerResolver email conflicts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('links to an existing customer when insert hits the email uniqueness constraint', async () => {
    const lookupQuery = createActiveLookupQuery(existingCustomer());
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(createLoadQuery())
        .mockReturnValueOnce(createEmailConflictInsertQuery())
        .mockReturnValueOnce(lookupQuery),
    } as unknown as SupabaseClient;

    const resolver = await createImportCustomerResolver(supabase, 'merchant-1');
    const result = await resolver.resolveCustomerId(supabase, createOrder());

    expect(result).toEqual({
      customerId: 'customer-existing-email',
      createdCustomer: false,
    });
    expect(lookupQuery.eq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(lookupQuery.ilike).toHaveBeenCalledWith('email', 'ada@example.com');
  });

  it('resolves mixed-case stored email collisions case-insensitively', async () => {
    const lookupQuery = createActiveLookupQuery([
      { ...existingCustomer('not-ada@example.com'), id: 'other-customer' },
      existingCustomer('Ada@Example.com'),
    ]);
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(createLoadQuery())
        .mockReturnValueOnce(
          createEmailConflictInsertQuery('customers_merchant_email_unique')
        )
        .mockReturnValueOnce(lookupQuery),
    } as unknown as SupabaseClient;

    const resolver = await createImportCustomerResolver(supabase, 'merchant-1');
    const result = await resolver.resolveCustomerId(
      supabase,
      createOrder({
        customer: {
          fullName: 'Ada Lovelace',
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@example.com',
          phone: '+2347000000000',
        },
      })
    );

    expect(result).toEqual({
      customerId: 'customer-existing-email',
      createdCustomer: false,
    });
    expect(lookupQuery.ilike).toHaveBeenCalledWith('email', 'ada@example.com');
  });

  it('recovers exact email collisions reported by idx_customers_merchant_email', async () => {
    const lookupQuery = createActiveLookupQuery(existingCustomer());
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(createLoadQuery())
        .mockReturnValueOnce(
          createEmailConflictInsertQuery('idx_customers_merchant_email')
        )
        .mockReturnValueOnce(lookupQuery),
    } as unknown as SupabaseClient;

    const resolver = await createImportCustomerResolver(supabase, 'merchant-1');
    const result = await resolver.resolveCustomerId(supabase, createOrder());

    expect(result).toEqual({
      customerId: 'customer-existing-email',
      createdCustomer: false,
    });
  });

  it('does not duplicate remembered phone matches for the same customer', async () => {
    const unexpectedInsertQuery = createInsertQuery({
      data: {
        id: 'customer-duplicate-phone',
        email: null,
        phone: '+2347000000000',
        user_id: null,
      },
      error: null,
    });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(createLoadQuery())
        .mockReturnValueOnce(createEmailConflictInsertQuery())
        .mockReturnValueOnce(createActiveLookupQuery(existingCustomer()))
        .mockReturnValueOnce(createEmailConflictInsertQuery())
        .mockReturnValueOnce(
          createActiveLookupQuery(existingCustomer('ada.alias@example.com'))
        )
        .mockReturnValueOnce(unexpectedInsertQuery),
    } as unknown as SupabaseClient;

    const resolver = await createImportCustomerResolver(supabase, 'merchant-1');
    await resolver.resolveCustomerId(supabase, createOrder());
    await resolver.resolveCustomerId(
      supabase,
      createOrder({
        customer: {
          fullName: 'Ada Alias',
          firstName: 'Ada',
          lastName: 'Alias',
          email: 'ada.alias@example.com',
          phone: '+2347000000000',
        },
      })
    );

    const result = await resolver.resolveCustomerId(
      supabase,
      createOrder({
        customer: {
          fullName: 'Phone Only',
          firstName: 'Phone',
          lastName: 'Only',
          email: null,
          phone: '+2347000000000',
        },
      })
    );

    expect(result).toEqual({
      customerId: 'customer-existing-email',
      createdCustomer: false,
    });
    expect(unexpectedInsertQuery.insert).not.toHaveBeenCalled();
  });

  it('explains email constraint conflicts caused by deleted customers', async () => {
    const deletedCustomer = {
      ...existingCustomer(),
      id: 'customer-deleted-email',
      deleted_at: '2026-07-01T00:00:00.000Z',
    };
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(createLoadQuery())
        .mockReturnValueOnce(createEmailConflictInsertQuery())
        .mockReturnValueOnce(createActiveLookupQuery(null))
        .mockReturnValueOnce(createDeletedLookupQuery(deletedCustomer)),
    } as unknown as SupabaseClient;

    const resolver = await createImportCustomerResolver(supabase, 'merchant-1');

    await expect(
      resolver.resolveCustomerId(supabase, createOrder())
    ).rejects.toThrow('Email is already used by a deleted customer record');
  });
});
