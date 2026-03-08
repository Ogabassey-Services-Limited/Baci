import { describe, expect, it } from 'vitest';
import {
  buildDescriptionExcerpt,
  getDeliveryEstimate,
} from './product-details-utils';

describe('getDeliveryEstimate', () => {
  const FIXED_DATE = new Date('2024-01-10T12:00:00Z');

  it('returns a 1–2 day window for Lagos', () => {
    const result = getDeliveryEstimate('Lagos', FIXED_DATE);
    const plus1 = new Date(FIXED_DATE);
    plus1.setDate(FIXED_DATE.getDate() + 1);
    const plus2 = new Date(FIXED_DATE);
    plus2.setDate(FIXED_DATE.getDate() + 2);

    const fmt = (d: Date) =>
      d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });

    expect(result).toBe(`${fmt(plus1)} - ${fmt(plus2)}`);
  });

  it('returns a 3–5 day window for Outside Lagos', () => {
    const result = getDeliveryEstimate('Outside Lagos', FIXED_DATE);
    const plus3 = new Date(FIXED_DATE);
    plus3.setDate(FIXED_DATE.getDate() + 3);
    const plus5 = new Date(FIXED_DATE);
    plus5.setDate(FIXED_DATE.getDate() + 5);

    const fmt = (d: Date) =>
      d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });

    expect(result).toBe(`${fmt(plus3)} - ${fmt(plus5)}`);
  });
});

describe('buildDescriptionExcerpt', () => {
  it('extracts text from a "Why Worth" H2 heading match', () => {
    const html =
      '<h2>Why It is Worth Buying</h2><p>Great value for money and premium build quality.</p>';
    expect(buildDescriptionExcerpt(html)).toBe(
      'Great value for money and premium build quality.'
    );
  });

  it('falls back to the second paragraph when no "Why Worth" H2 is present', () => {
    const html = '<p>First paragraph.</p><p>Second paragraph content here.</p>';
    expect(buildDescriptionExcerpt(html)).toBe('Second paragraph content here.');
  });

  it('falls back to plain text sentences (3rd–5th) when no paragraph structure matches', () => {
    const description =
      'First sentence here. Second sentence here. Third sentence here. Fourth sentence here. Fifth sentence here.';
    const result = buildDescriptionExcerpt(description);
    expect(result).toBe(
      'Third sentence here. Fourth sentence here. Fifth sentence here.'
    );
  });

  it('returns the full text without appending "..." when the match is 200 chars or fewer', () => {
    const shortText = '<h2>Why It Worth</h2><p>Short benefit text.</p>';
    const result = buildDescriptionExcerpt(shortText);
    expect(result).toBe('Short benefit text.');
    expect(result.endsWith('...')).toBe(false);
  });

  it('truncates to 200 chars and appends "..." when the matched text is longer', () => {
    const longBenefit = 'A'.repeat(210);
    const html = `<h2>Why It Worth</h2><p>${longBenefit}</p>`;
    const result = buildDescriptionExcerpt(html);
    expect(result).toBe(`${'A'.repeat(200)}...`);
    expect(result.length).toBe(203); // 200 + '...'
  });

  it('returns an empty string for empty input', () => {
    expect(buildDescriptionExcerpt('')).toBe('');
  });
});
