import { buildNegotiationCustomerContact } from './negotiation-customer-contact';

describe('buildNegotiationCustomerContact', () => {
  it('requires a phone for guests', () => {
    expect(buildNegotiationCustomerContact(null, '')).toMatchObject({
      errorMessage:
        'Enter a Phone / WhatsApp number so the merchant can reach you about this offer.',
      normalizedPhone: null,
      userId: null,
    });
  });

  it('allows signed-in customers with an empty phone', () => {
    expect(buildNegotiationCustomerContact('customer-1', '')).toMatchObject({
      errorMessage: null,
      normalizedPhone: null,
      userId: 'customer-1',
    });
  });

  it('allows guests with a normalized phone', () => {
    expect(
      buildNegotiationCustomerContact(null, '2348031234567')
    ).toMatchObject({
      errorMessage: null,
      normalizedPhone: '2348031234567',
      userId: null,
    });
  });

  it('normalizes a valid phone for a guest', () => {
    expect(buildNegotiationCustomerContact(null, '0803 123 4567')).toEqual({
      errorMessage: null,
      normalizedPhone: '2348031234567',
      userId: null,
    });
  });

  it('returns the validation message before a guest upload', () => {
    expect(buildNegotiationCustomerContact(null, '')).toMatchObject({
      errorMessage:
        'Enter a Phone / WhatsApp number so the merchant can reach you about this offer.',
      normalizedPhone: null,
    });
  });

  it('rejects a nonblank invalid phone', () => {
    expect(buildNegotiationCustomerContact(null, 'not a phone')).toEqual({
      errorMessage: 'Enter a valid Phone / WhatsApp number.',
      normalizedPhone: null,
      userId: null,
    });
  });
});
