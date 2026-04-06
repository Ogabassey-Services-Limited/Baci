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

describe('createImportCustomerResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reuses existing customers by normalized email', async () => {
    const loadQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
    };
    loadQuery.select.mockReturnValue(loadQuery);
    loadQuery.eq.mockReturnValue(loadQuery);
    loadQuery.is.mockResolvedValue({
      data: [
        {
          id: 'customer-1',
          email: 'Ada@Example.com',
          phone: null,
          user_id: null,
        },
      ],
      error: null,
    });

    const supabase = {
      from: vi.fn().mockReturnValue(loadQuery),
    } as unknown as SupabaseClient;

    const resolver = await createImportCustomerResolver(supabase, 'merchant-1');
    const result = await resolver.resolveCustomerId(supabase, createOrder());

    expect(result).toEqual({
      customerId: 'customer-1',
      createdCustomer: false,
    });
  });

  it('reuses a unique phone-only unlinked customer when email is missing', async () => {
    const loadQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
    };
    loadQuery.select.mockReturnValue(loadQuery);
    loadQuery.eq.mockReturnValue(loadQuery);
    loadQuery.is.mockResolvedValue({
      data: [
        {
          id: 'customer-2',
          email: null,
          phone: '+234 700 000 0000',
          user_id: null,
        },
      ],
      error: null,
    });

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
      customerId: 'customer-2',
      createdCustomer: false,
    });
  });

  it('creates a new customer when no safe match exists', async () => {
    const loadQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
    };
    loadQuery.select.mockReturnValue(loadQuery);
    loadQuery.eq.mockReturnValue(loadQuery);
    loadQuery.is.mockResolvedValue({
      data: [],
      error: null,
    });

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
        phone: '+2347000000000',
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
      expect.objectContaining({
        merchant_id: 'merchant-1',
        email: 'ada@example.com',
      })
    );
  });

  it('throws when loading customers fails', async () => {
    const loadQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
    };
    loadQuery.select.mockReturnValue(loadQuery);
    loadQuery.eq.mockReturnValue(loadQuery);
    loadQuery.is.mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    });

    const supabase = {
      from: vi.fn().mockReturnValue(loadQuery),
    } as unknown as SupabaseClient;

    await expect(
      createImportCustomerResolver(supabase, 'merchant-1')
    ).rejects.toThrow('Failed to load customers for import: boom');
  });

  it('links to existing phone holder (with email) when order has no email', async () => {
    // Case A: phone-only order, existing customer holds the phone and has an email
    const loadQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
    };
    loadQuery.select.mockReturnValue(loadQuery);
    loadQuery.eq.mockReturnValue(loadQuery);
    loadQuery.is.mockResolvedValue({
      data: [
        {
          id: 'customer-phone-holder',
          email: 'other@example.com',
          phone: '+2347000000000',
          user_id: null,
        },
      ],
      error: null,
    });

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
    // No INSERT should have been attempted
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('inserts with phone=null when email-identified order has a taken phone', async () => {
    // Case B: order has email (not in cache) + phone already held by another customer
    const loadQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
    };
    loadQuery.select.mockReturnValue(loadQuery);
    loadQuery.eq.mockReturnValue(loadQuery);
    loadQuery.is.mockResolvedValue({
      data: [
        {
          id: 'customer-phone-holder',
          email: 'other@example.com',
          phone: '+2347000000000',
          user_id: null,
        },
      ],
      error: null,
    });

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
    // Case C: first INSERT hits 23505 (concurrent writer), retry with phone=null succeeds
    const loadQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
    };
    loadQuery.select.mockReturnValue(loadQuery);
    loadQuery.eq.mockReturnValue(loadQuery);
    loadQuery.is.mockResolvedValue({ data: [], error: null });

    const insertQuery = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    insertQuery.insert.mockReturnValue(insertQuery);
    insertQuery.select.mockReturnValue(insertQuery);
    // First call: phone constraint violation
    insertQuery.single.mockResolvedValueOnce({
      data: null,
      error: {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "customers_merchant_phone_unique"',
      },
    });
    // Second call (retry without phone): succeeds
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
    // Second insert (retry) must use phone: null
    expect(insertQuery.insert).toHaveBeenLastCalledWith(
      expect.objectContaining({ phone: null, email: 'ada@example.com' })
    );
  });

  it('throws when creating a new customer fails', async () => {
    const loadQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
    };
    loadQuery.select.mockReturnValue(loadQuery);
    loadQuery.eq.mockReturnValue(loadQuery);
    loadQuery.is.mockResolvedValue({
      data: [],
      error: null,
    });

    const insertQuery = {
      insert: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    insertQuery.insert.mockReturnValue(insertQuery);
    insertQuery.select.mockReturnValue(insertQuery);
    insertQuery.single.mockResolvedValue({
      data: null,
      error: { message: 'insert failed' },
    });

    const supabase = {
      from: vi
        .fn()
        .mockReturnValueOnce(loadQuery)
        .mockReturnValueOnce(insertQuery),
    } as unknown as SupabaseClient;

    const resolver = await createImportCustomerResolver(supabase, 'merchant-1');

    await expect(
      resolver.resolveCustomerId(supabase, createOrder())
    ).rejects.toThrow('Failed to create imported customer: insert failed');
  });
});
