import { describe, expect, it } from '@jest/globals';
import { findMatchingConditionOffer } from './product-condition-offers';

const offers = [
  {
    id: 'offer-refurbished',
    condition: 'refurbished' as const,
    price: 510000,
    stock_quantity: 2,
  },
  {
    id: 'offer-uk-used',
    condition: 'uk_used' as const,
    price: 495000,
    stock_quantity: 1,
  },
];

describe('findMatchingConditionOffer', () => {
  it('matches canonical selections against legacy aliases', () => {
    expect(findMatchingConditionOffer(offers, 'open_box')).toEqual(offers[0]);
    expect(findMatchingConditionOffer(offers, 'used')).toEqual(offers[1]);
  });

  it('prefers exact matches over canonical alias matches', () => {
    const exactOffer = {
      id: 'offer-open-box',
      condition: 'open_box' as const,
      price: 525000,
      stock_quantity: 3,
    };

    expect(
      findMatchingConditionOffer([...offers, exactOffer], 'open_box')
    ).toEqual(exactOffer);
  });

  it('falls back to a single offer when no condition is selected', () => {
    const singleOffer = [
      {
        id: 'offer-scratch-and-dent',
        condition: 'scratch_and_dent' as never,
        price: 470000,
        stock_quantity: 2,
      },
    ];

    expect(findMatchingConditionOffer(singleOffer, null)).toEqual(
      singleOffer[0]
    );
  });

  it('does not guess across multiple offers when no condition is selected', () => {
    expect(findMatchingConditionOffer(offers, null)).toBeNull();
  });
});
