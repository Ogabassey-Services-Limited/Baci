import {
  buildNegotiationCustomerContact,
  getGuestNegotiationPhoneError,
} from './negotiation-customer-contact';

describe('getGuestNegotiationPhoneError', () => {
  it('requires a phone for guests', () => {
    expect(getGuestNegotiationPhoneError(null, null)).toBe(
      'Enter a Phone / WhatsApp number so the merchant can reach you about this offer.'
    );
  });

  it('allows signed-in customers or guests with a normalized phone', () => {
    expect(getGuestNegotiationPhoneError('customer-1', null)).toBeNull();
    expect(getGuestNegotiationPhoneError(null, '2348031234567')).toBeNull();
  });
});

describe('buildNegotiationCustomerContact', () => {
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
