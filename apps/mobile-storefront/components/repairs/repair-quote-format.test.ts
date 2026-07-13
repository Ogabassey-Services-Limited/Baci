import type { RepairQuoteSummary } from '@baci/shared/repairs';
import { describe, expect, it } from '@jest/globals';
import {
  formatQuotePrice,
  formatRepairNaira,
  quoteMetaLabel,
} from './repair-quote-format';

const baseQuote: RepairQuoteSummary = {
  id: 'q1',
  serviceTypeId: 'st1',
  serviceTypeName: 'Screen Replacement',
  price: 25000,
  isFromPrice: true,
  partQuality: null,
  turnaround: null,
  warrantyDays: null,
  description: null,
};

describe('formatRepairNaira', () => {
  it('formats an integer amount with a naira sign and thousands separators', () => {
    expect(formatRepairNaira(25000)).toBe('₦25,000');
  });

  it('rounds fractional amounts', () => {
    expect(formatRepairNaira(1499.6)).toBe('₦1,500');
  });
});

describe('formatQuotePrice', () => {
  it('prefixes "From" when the quote is a from-price', () => {
    expect(formatQuotePrice(baseQuote)).toBe('From ₦25,000');
  });

  it('shows an exact price when the quote is not a from-price', () => {
    expect(formatQuotePrice({ ...baseQuote, isFromPrice: false })).toBe(
      '₦25,000'
    );
  });
});

describe('quoteMetaLabel', () => {
  it('returns null when no meta fields are set', () => {
    expect(quoteMetaLabel(baseQuote)).toBeNull();
  });

  it('joins the populated meta fields with a separator', () => {
    expect(
      quoteMetaLabel({
        ...baseQuote,
        partQuality: 'OEM',
        turnaround: '2 days',
        warrantyDays: 90,
      })
    ).toBe('OEM · 2 days · 90-day warranty');
  });

  it('singularizes a one-day warranty', () => {
    expect(quoteMetaLabel({ ...baseQuote, warrantyDays: 1 })).toBe(
      '1-day warranty'
    );
  });
});
