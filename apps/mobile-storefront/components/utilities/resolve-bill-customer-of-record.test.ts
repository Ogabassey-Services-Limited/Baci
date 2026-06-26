import { resolveBillCustomerOfRecord } from './resolve-bill-customer-of-record';

describe('resolveBillCustomerOfRecord', () => {
  it('prefers the verified meter/account holder name over the buyer profile', () => {
    const result = resolveBillCustomerOfRecord({
      customer: {
        first_name: 'Bassey',
        last_name: 'John',
        email: 'bassey@example.com',
      },
      verifiedCustomerName: 'JANE METER-OWNER',
      verifiedCustomerAddress: '12 Marina Road, Lagos',
    });

    expect(result).toEqual({
      customerName: 'JANE METER-OWNER',
      customerAddress: '12 Marina Road, Lagos',
    });
  });

  it('falls back to the buyer full name, then email, when unverified', () => {
    expect(
      resolveBillCustomerOfRecord({
        customer: { first_name: 'Ada', last_name: 'Buyer', email: 'a@x.com' },
        verifiedCustomerName: null,
        verifiedCustomerAddress: null,
      })
    ).toEqual({ customerName: 'Ada Buyer', customerAddress: undefined });

    expect(
      resolveBillCustomerOfRecord({
        customer: { first_name: null, last_name: null, email: 'a@x.com' },
        verifiedCustomerName: null,
        verifiedCustomerAddress: null,
      })
    ).toEqual({ customerName: 'a@x.com', customerAddress: undefined });
  });

  it('returns undefined name/address when nothing is available', () => {
    expect(
      resolveBillCustomerOfRecord({
        customer: null,
        verifiedCustomerName: null,
        verifiedCustomerAddress: null,
      })
    ).toEqual({ customerName: undefined, customerAddress: undefined });
  });

  it('trims whitespace and ignores blank verified values', () => {
    expect(
      resolveBillCustomerOfRecord({
        customer: { email: 'a@x.com' },
        verifiedCustomerName: '   ',
        verifiedCustomerAddress: '   ',
      })
    ).toEqual({ customerName: 'a@x.com', customerAddress: undefined });
  });
});
