import { describe, expect, it } from '@jest/globals';
import type { SavedVtuCard } from '@/lib/vtu-checkout';
import { formatCardMeta, getExpiryPart } from './card-formatting.helpers';

describe('card formatting helpers', () => {
  it('normalizes expiry values to two digits', () => {
    expect(getExpiryPart('8')).toBe('08');
    expect(getExpiryPart('2029')).toBe('29');
    expect(getExpiryPart(null)).toBeNull();
  });

  it('formats saved card metadata with masked digits and expiry', () => {
    const card: SavedVtuCard = {
      bank: 'GTBank',
      brand: 'visa',
      exp_month: '12',
      exp_year: '2029',
      id: 'card-1',
      is_default: true,
      label: 'Visa card',
      last4: '4242',
      provider: 'paystack',
    };

    expect(formatCardMeta(card)).toBe('•••• 4242 · 12/29');
  });

  it.each([
    {
      card: { last4: null, exp_month: '12', exp_year: '2029' },
      expected: '•••• · 12/29',
    },
    {
      card: { last4: '4242', exp_month: null, exp_year: '2029' },
      expected: '•••• 4242 · Saved card',
    },
    {
      card: { last4: '4242', exp_month: '12', exp_year: null },
      expected: '•••• 4242 · Saved card',
    },
    {
      card: { last4: null, exp_month: null, exp_year: null },
      expected: '•••• · Saved card',
    },
  ])('formats saved card metadata with missing fields', ({
    card,
    expected,
  }) => {
    const savedCard: SavedVtuCard = {
      bank: null,
      brand: null,
      exp_month: card.exp_month,
      exp_year: card.exp_year,
      id: 'card-1',
      is_default: false,
      label: 'Saved card',
      last4: card.last4,
      provider: 'paystack',
    };

    expect(formatCardMeta(savedCard)).toBe(expected);
  });
});
