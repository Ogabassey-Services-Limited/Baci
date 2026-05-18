import { describe, expect, it } from '@jest/globals';
import { validateNegotiationOffer } from './negotiation-validators';

describe('validateNegotiationOffer', () => {
  it('returns parsed amount for a valid lower offer', () => {
    const result = validateNegotiationOffer({
      currentPrice: 500000,
      offer: '₦470,000',
    });

    expect(result).toEqual({
      amount: 470000,
      valid: true,
    });
  });

  it('rejects malformed offers with multiple decimals', () => {
    const result = validateNegotiationOffer({
      currentPrice: 500000,
      offer: '12.34.56',
    });

    expect(result).toEqual({
      message: 'Please enter a valid price.',
      title: 'Invalid Offer',
      valid: false,
    });
  });

  it.each(['', '   ', '0', '-100', '₦₦₦', '9'.repeat(400)])(
    'rejects invalid offer input: %s',
    (offer) => {
      const result = validateNegotiationOffer({
        currentPrice: 500000,
        offer,
      });

      expect(result).toEqual({
        message: 'Please enter a valid price.',
        title: 'Invalid Offer',
        valid: false,
      });
    }
  );

  it('accepts leading and trailing decimal formats when the value is valid', () => {
    const leadingDecimal = validateNegotiationOffer({
      currentPrice: 500000,
      offer: '.5',
    });
    const trailingDecimal = validateNegotiationOffer({
      currentPrice: 500000,
      offer: '5.',
    });

    expect(leadingDecimal).toEqual({
      amount: 0.5,
      valid: true,
    });
    expect(trailingDecimal).toEqual({
      amount: 5,
      valid: true,
    });
  });

  it('rejects offers greater than or equal to the current price', () => {
    const result = validateNegotiationOffer({
      currentPrice: 500000,
      offer: '500000',
    });

    expect(result).toEqual({
      message: 'Negotiated price must be lower than the current price.',
      title: 'Invalid Offer',
      valid: false,
    });
  });
});
