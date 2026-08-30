import {
  areCheckoutContactFieldsSettled,
  isCheckoutContactComplete,
} from './checkout-contact-readiness';

describe('isCheckoutContactComplete', () => {
  it('accepts complete contact details', () => {
    expect(
      isCheckoutContactComplete({
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '+2349169449282',
      })
    ).toBe(true);
  });

  it('rejects missing or invalid contact details', () => {
    expect(
      isCheckoutContactComplete({
        email: 'not-an-email',
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '+2349169449282',
      })
    ).toBe(false);
    expect(
      isCheckoutContactComplete({
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
      })
    ).toBe(false);
  });
});

describe('areCheckoutContactFieldsSettled', () => {
  it('does not unlock checkout while a valid email is still being edited', () => {
    expect(
      areCheckoutContactFieldsSettled({
        dirtyFields: { email: true },
        touchedFields: {},
      })
    ).toBe(false);
    expect(
      areCheckoutContactFieldsSettled({
        dirtyFields: { email: true },
        touchedFields: { email: true },
      })
    ).toBe(true);
  });

  it('treats pristine prefilled contact fields as settled', () => {
    expect(
      areCheckoutContactFieldsSettled({
        dirtyFields: {},
        touchedFields: {},
      })
    ).toBe(true);
  });
});
