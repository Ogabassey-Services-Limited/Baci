import { toPaymentInitializeData } from './payment-initialize-data';

describe('toPaymentInitializeData', () => {
  it('returns the object unchanged for object payloads', () => {
    const payload = { success: true, reference: 'ref-1' };

    const result = toPaymentInitializeData(payload);

    expect(result).toBe(payload);
  });

  it('collapses null to an empty envelope', () => {
    expect(toPaymentInitializeData(null)).toEqual({});
  });

  it('collapses non-object primitives to an empty envelope', () => {
    expect(toPaymentInitializeData('error')).toEqual({});
    expect(toPaymentInitializeData(42)).toEqual({});
    expect(toPaymentInitializeData(undefined)).toEqual({});
  });
});
