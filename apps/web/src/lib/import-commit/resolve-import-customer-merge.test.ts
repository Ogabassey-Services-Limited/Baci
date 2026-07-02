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

describe('createImportCustomerResolver merge behavior', () => {
  it('enriches a phone-only customer with an imported email', async () => {
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
          id: 'customer-phone-only',
          email: null,
          phone: '+2347000000000',
          user_id: null,
        },
      ],
      error: null,
    });

    const updateQuery = {
      update: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
    };
    updateQuery.update.mockReturnValue(updateQuery);
    updateQuery.eq.mockReturnValue(updateQuery);
    updateQuery.select.mockReturnValue(updateQuery);
    updateQuery.single.mockResolvedValue({
      data: {
        id: 'customer-phone-only',
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
  });

  it('reuses an unclaimed phone customer without overwriting a different email', async () => {
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
          email: 'previous@example.com',
          phone: '+2347000000000',
          user_id: null,
        },
      ],
      error: null,
    });

    const supabase = {
      from: vi.fn().mockReturnValueOnce(loadQuery),
    } as unknown as SupabaseClient;

    const resolver = await createImportCustomerResolver(supabase, 'merchant-1');
    const result = await resolver.resolveCustomerId(supabase, createOrder());

    expect(result).toEqual({
      customerId: 'customer-phone-holder',
      createdCustomer: false,
    });
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('reuses an existing email customer when the phone retry hits the email constraint', async () => {
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
