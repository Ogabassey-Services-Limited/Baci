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
