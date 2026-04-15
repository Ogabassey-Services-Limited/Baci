import { describe, expect, it } from 'vitest';
import {
  formatCanonicalProductConditionLabel,
  normalizeCanonicalProductCondition,
  toGoogleListingCondition,
  toSchemaItemConditionUri,
} from './product-condition';

describe('normalizeCanonicalProductCondition', () => {
  it('preserves canonical conditions', () => {
    expect(normalizeCanonicalProductCondition('new')).toBe('new');
    expect(normalizeCanonicalProductCondition('used')).toBe('used');
    expect(normalizeCanonicalProductCondition('open_box')).toBe('open_box');
  });

  it('maps uk_used to used and refurbished to open_box', () => {
    expect(normalizeCanonicalProductCondition('uk_used')).toBe('used');
    expect(normalizeCanonicalProductCondition('UK Used')).toBe('used');
    expect(normalizeCanonicalProductCondition('refurbished')).toBe('open_box');
    expect(normalizeCanonicalProductCondition('Refurbished')).toBe('open_box');
  });

  it('returns an empty string for unsupported values', () => {
    expect(normalizeCanonicalProductCondition('premium_used')).toBe('');
    expect(normalizeCanonicalProductCondition(null)).toBe('');
    expect(normalizeCanonicalProductCondition(undefined)).toBe('');
  });
});

describe('formatCanonicalProductConditionLabel', () => {
  it('formats canonical labels after alias normalization', () => {
    expect(formatCanonicalProductConditionLabel('uk_used')).toBe('Used');
    expect(formatCanonicalProductConditionLabel('refurbished')).toBe(
      'Open Box'
    );
    expect(formatCanonicalProductConditionLabel('open_box')).toBe('Open Box');
  });
});

describe('toGoogleListingCondition', () => {
  it('maps canonical internal conditions to Google listing values', () => {
    expect(toGoogleListingCondition('new')).toBe('new');
    expect(toGoogleListingCondition('used')).toBe('used');
    expect(toGoogleListingCondition('open_box')).toBe('refurbished');
  });

  it('maps legacy aliases to the same Google listing values', () => {
    expect(toGoogleListingCondition('uk_used')).toBe('used');
    expect(toGoogleListingCondition('refurbished')).toBe('refurbished');
  });
});

describe('toSchemaItemConditionUri', () => {
  it('returns the correct Schema.org itemCondition URI', () => {
    expect(toSchemaItemConditionUri('new')).toBe(
      'https://schema.org/NewCondition'
    );
    expect(toSchemaItemConditionUri('used')).toBe(
      'https://schema.org/UsedCondition'
    );
    expect(toSchemaItemConditionUri('open_box')).toBe(
      'https://schema.org/RefurbishedCondition'
    );
  });
});
