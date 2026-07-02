import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  createImportCustomerResolver,
  type ImportCustomerResolver,
} from '@/lib/import-commit/resolve-import-customer';

type ImportResolverOrder = Parameters<
  ImportCustomerResolver['resolveCustomerId']
>[1];

function createOrder(email: string) {
  return {
    customer: {
      fullName: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email,
      phone: '+2347000000000',
    },
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
  query.is.mockResolvedValue({
    data: [
      {
        id: 'customer-phone-only',
        email: null,
        phone: '+2347000000000',
        user_id: null,
      },
    ],
    error: null,
  });
  return query;
}

function createUpdateConflictQuery() {
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
  query.maybeSingle.mockResolvedValue({
    data: null,
    error: {
      code: '23505',
      message:
        'duplicate key value violates unique constraint "customers_merchant_id_email_key"',
    },
  });
  return query;
}

function createUpdateSuccessQuery(email: string) {
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
  query.maybeSingle.mockResolvedValue({
    data: {
      id: 'customer-phone-only',
      email,
      phone: '+2347000000000',
      user_id: null,
    },
    error: null,
  });
  return query;
}

function createEmailLookupQuery() {
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
  query.limit.mockResolvedValue({
    data: [
      {
        id: 'customer-email',
        email: 'ada@example.com',
        phone: null,
        user_id: null,
        deleted_at: null,
      },
    ],
    error: null,
  });
  return query;
}

describe('createImportCustomerResolver phone enrichment races', () => {
  it('does not reuse the email-conflict customer for later different-email rows', async () => {
    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(createLoadQuery())
        .mockReturnValueOnce(createUpdateConflictQuery())
        .mockReturnValueOnce(createEmailLookupQuery())
        .mockReturnValueOnce(createUpdateSuccessQuery('bob@example.com')),
    } as unknown as SupabaseClient;

    const resolver = await createImportCustomerResolver(supabase, 'merchant-1');
    const firstResult = await resolver.resolveCustomerId(
      supabase,
      createOrder('ada@example.com')
    );
    const secondResult = await resolver.resolveCustomerId(
      supabase,
      createOrder('bob@example.com')
    );

    expect(firstResult).toEqual({
      customerId: 'customer-email',
      createdCustomer: false,
    });
    expect(secondResult).toEqual({
      customerId: 'customer-phone-only',
      createdCustomer: false,
    });
    expect(supabase.from).toHaveBeenCalledTimes(4);
  });
});
