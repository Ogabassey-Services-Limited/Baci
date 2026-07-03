import { describe, expect, it } from 'vitest';
import { getCustomerEditHeader } from './customer-edit-header';

describe('getCustomerEditHeader', () => {
  it('uses person first and last names for individual customers', () => {
    expect(
      getCustomerEditHeader({
        companyName: '',
        customerType: 'individual',
        firstName: 'Ada',
        lastName: 'Lovelace',
      })
    ).toEqual({
      initials: 'AL',
      name: 'Ada Lovelace',
    });
  });

  it('uses company names for company customer headers', () => {
    expect(
      getCustomerEditHeader({
        companyName: 'Acme Retail Limited',
        customerType: 'company',
        firstName: '',
        lastName: '',
      })
    ).toEqual({
      initials: 'AR',
      name: 'Acme Retail Limited',
    });
  });

  it('falls back to a placeholder initial when no name is available', () => {
    expect(
      getCustomerEditHeader({
        companyName: '',
        customerType: 'company',
        firstName: '',
        lastName: '',
      })
    ).toEqual({
      initials: '?',
      name: '',
    });
  });
});
