import {
  buildAirtimeGatewayParams,
  getAirtimeCustomerName,
  resolveAirtimeProvider,
  sanitizeAirtimeAmountInput,
  sanitizePhoneDigits,
  validateAirtimePurchaseInput,
} from './airtime-form-controller.helpers';

describe('airtime-form-controller.helpers', () => {
  it('normalizes phone and amount inputs', () => {
    expect(sanitizePhoneDigits('+234 (803) 123-4567')).toBe('2348031234567');
    expect(sanitizeAirtimeAmountInput('₦12,500.90')).toBe('1250090');
  });

  it('resolves provider from detected prefixes', () => {
    expect(resolveAirtimeProvider('08031234567')).toBe('mtn');
    expect(resolveAirtimeProvider('')).toBeNull();
    expect(resolveAirtimeProvider('00000000000')).toBeNull();
  });

  it('validates airtime purchase preconditions', () => {
    expect(
      validateAirtimePurchaseInput({
        amount: '',
        isWalletOnly: false,
        numericAmount: 0,
        phoneNumber: '',
        selectedGateway: null,
        selectedProvider: null,
        selectedSavedCardId: null,
      })
    ).toEqual({
      title: 'Missing Information',
      message: 'Please fill in all fields.',
    });

    expect(
      validateAirtimePurchaseInput({
        amount: '40',
        isWalletOnly: false,
        numericAmount: 40,
        phoneNumber: '08031234567',
        selectedGateway: 'paystack',
        selectedProvider: 'mtn',
        selectedSavedCardId: null,
      })
    ).toEqual({
      title: 'Invalid Amount',
      message: 'Amount must be between ₦50 and ₦50,000.',
    });

    expect(
      validateAirtimePurchaseInput({
        amount: '500',
        isWalletOnly: false,
        numericAmount: 500,
        phoneNumber: '08031234567',
        selectedGateway: null,
        selectedProvider: 'mtn',
        selectedSavedCardId: null,
      })
    ).toEqual({
      title: 'Select Payment Method',
      message: 'Choose a payment method before continuing.',
    });

    expect(
      validateAirtimePurchaseInput({
        amount: '500',
        isWalletOnly: true,
        numericAmount: 500,
        phoneNumber: '08031234567',
        selectedGateway: null,
        selectedProvider: 'mtn',
        selectedSavedCardId: null,
      })
    ).toBeNull();
  });

  it('builds customer names with sensible fallback order', () => {
    expect(
      getAirtimeCustomerName({
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
      })
    ).toBe('Jane Doe');
    expect(getAirtimeCustomerName({ email: 'jane@example.com' })).toBe(
      'jane@example.com'
    );
    expect(getAirtimeCustomerName(null)).toBe('Customer');
  });

  it('builds payment-gateway params for airtime checkout', () => {
    expect(
      buildAirtimeGatewayParams({
        amount: 2500,
        authorizationUrl: 'https://pay.example/authorize',
        customerIdentifier: '08031234567',
        gateway: 'paystack',
        reference: 'REF123',
      })
    ).toEqual({
      amount: '2500',
      authorizationUrl: 'https://pay.example/authorize',
      customerIdentifier: '08031234567',
      gateway: 'paystack',
      paymentKind: 'vtu',
      reference: 'REF123',
      utilityType: 'airtime',
    });
  });
});
