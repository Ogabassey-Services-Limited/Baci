import { describe, expect, it } from 'vitest';
import {
  buildCustomerMaps,
  isCustomerEmailConstraintError,
  rememberCustomer,
} from './resolve-import-customer-helpers';

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
});
