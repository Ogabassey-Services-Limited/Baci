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

describe('createImportCustomerResolver phone conflicts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('links to existing phone holder with email when order has no email', async () => {
    const loadQuery = createLoadQuery([
      {
        id: 'customer-phone-holder',
        email: 'other@example.com',
        phone: '+2347000000000',
        user_id: null,
      },
    ]);

    const supabase = {
      from: vi.fn().mockReturnValue(loadQuery),
    } as unknown as SupabaseClient;

    const resolver = await createImportCustomerResolver(supabase, 'merchant-1');
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
      customerId: 'customer-phone-holder',
      createdCustomer: false,
    });
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('inserts with phone=null when email-identified order has a taken phone', async () => {
    const loadQuery = createLoadQuery([
      {
        id: 'customer-phone-holder',
        email: 'other@example.com',
        phone: '+2347000000000',
        user_id: null,
      },
    ]);
    const insertQuery = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    insertQuery.insert.mockReturnValue(insertQuery);
    insertQuery.select.mockReturnValue(insertQuery);
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
      expect.objectContaining({ phone: null, email: 'ada@example.com' })
    );
  });

  it('retries insert with phone=null on concurrent phone constraint violation', async () => {
    const loadQuery = createLoadQuery([]);
    const insertQuery = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    insertQuery.insert.mockReturnValue(insertQuery);
    insertQuery.select.mockReturnValue(insertQuery);
    insertQuery.single.mockResolvedValueOnce({
      data: null,
      error: {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "customers_merchant_phone_unique"',
      },
    });
    insertQuery.single.mockResolvedValueOnce({
      data: {
        id: 'customer-retry',
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
        .mockReturnValueOnce(insertQuery)
        .mockReturnValueOnce(insertQuery),
    } as unknown as SupabaseClient;

    const resolver = await createImportCustomerResolver(supabase, 'merchant-1');
    const result = await resolver.resolveCustomerId(supabase, createOrder());

    expect(result).toEqual({
      customerId: 'customer-retry',
      createdCustomer: true,
    });
    expect(insertQuery.insert).toHaveBeenLastCalledWith(
      expect.objectContaining({ phone: null, email: 'ada@example.com' })
    );
  });

  it('throws when retrying a phone constraint violation still fails', async () => {
    const loadQuery = createLoadQuery([]);
    const insertQuery = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    insertQuery.insert.mockReturnValue(insertQuery);
    insertQuery.select.mockReturnValue(insertQuery);
    insertQuery.single.mockResolvedValueOnce({
      data: null,
      error: {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "customers_merchant_phone_unique"',
      },
    });
    insertQuery.single.mockResolvedValueOnce({
      data: null,
      error: { message: 'retry failed' },
    });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(loadQuery)
        .mockReturnValueOnce(insertQuery)
        .mockReturnValueOnce(insertQuery),
    } as unknown as SupabaseClient;

    const resolver = await createImportCustomerResolver(supabase, 'merchant-1');

    await expect(
      resolver.resolveCustomerId(supabase, createOrder())
    ).rejects.toThrow('Failed to create imported customer: retry failed');
  });
});
