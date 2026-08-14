import { describe, expect, it } from 'vitest';
import { getDeliveryEstimate } from './product-delivery-estimate';
import { buildDescriptionExcerpt } from './build-description-excerpt';

describe('getDeliveryEstimate', () => {
  const FIXED_DATE = new Date('2024-01-10T12:00:00Z');

  it('returns a 1–2 day window for Lagos', () => {
    const result = getDeliveryEstimate('Lagos', FIXED_DATE);
    const plus1 = new Date(FIXED_DATE);
    plus1.setDate(FIXED_DATE.getDate() + 1);
    const plus2 = new Date(FIXED_DATE);
    plus2.setDate(FIXED_DATE.getDate() + 2);

    const fmt = (d: Date) =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Lagos',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }).format(d);

    expect(result).toBe(`${fmt(plus1)} - ${fmt(plus2)}`);
  });

  it('returns a 3–5 day window for Outside Lagos', () => {
    const result = getDeliveryEstimate('Outside Lagos', FIXED_DATE);
    const plus3 = new Date(FIXED_DATE);
    plus3.setDate(FIXED_DATE.getDate() + 3);
    const plus5 = new Date(FIXED_DATE);
    plus5.setDate(FIXED_DATE.getDate() + 5);

    const fmt = (d: Date) =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Lagos',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }).format(d);

    expect(result).toBe(`${fmt(plus3)} - ${fmt(plus5)}`);
  });
});

describe('buildDescriptionExcerpt', () => {
  it('extracts text from a "Why Worth" H2 heading match', () => {
    const html =
      '<h2>Why It is Worth Buying</h2><p>Great value for money and premium build quality.</p>';
    const result = buildDescriptionExcerpt(html);
    expect(result).toBe('Great value for money and premium build quality.');
  });

  it('filters specification sentences from "Why Worth" paragraph with prose and specs', () => {
    const html =
      '<h2>Why It is Worth Buying</h2><p>Incredible speed and battery life. Storage: 2TB PCIe NVMe SSD. RAM: 64GB.</p>';
    const result = buildDescriptionExcerpt(html);
    expect(result).toBe('Incredible speed and battery life.');
  });

  it('returns an empty string when "Why Worth" paragraph contains only specification sentences', () => {
    const html =
      '<h2>Why It is Worth Buying</h2><p>Storage: 2TB PCIe NVMe SSD. RAM: 64GB. Warranty: 1 Year.</p>';
    const result = buildDescriptionExcerpt(html);
    expect(result).toBe('');
  });

  it('falls back to the second paragraph when no "Why Worth" H2 is present', () => {
    const html = '<p>First paragraph.</p><p>Second paragraph content here.</p>';
    const result = buildDescriptionExcerpt(html);
    expect(result).toBe('Second paragraph content here.');
  });

  it('filters specification sentences from second paragraph with prose and specs', () => {
    const html =
      '<p>First paragraph.</p><p>A premium flagship phone. Storage: 1TB NVMe. RAM: 16GB.</p>';
    const result = buildDescriptionExcerpt(html);
    expect(result).toBe('A premium flagship phone.');
  });

  it('returns an empty string when second paragraph contains only specification sentences', () => {
    const html =
      '<p>First paragraph.</p><p>Storage: 1TB NVMe. RAM: 16GB. Condition: Open Box.</p>';
    const result = buildDescriptionExcerpt(html);
    expect(result).toBe('');
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
    const result = buildDescriptionExcerpt('');
    expect(result).toBe('');
  });

  it('filters out redundant spec key-value sentences and returns empty when description is purely specs', () => {
    const specDump =
      'Dell XPS 16 9650. Storage: 2TB PCIe® NVMe™ SSD ( UPGRADABLE). RAM: 64GB RAM (ONBOARD – NON-UPGRADABLE). Colour: Platinum. Condition: New.';
    const result = buildDescriptionExcerpt(specDump);
    expect(result).toBe('');
  });

  it('preserves marketing descriptions that include actual prose content', () => {
    const prose =
      'iPhone 15 Pro Max. Forged in titanium and featuring the groundbreaking A17 Pro chip. Customizable Action button and powerful camera system.';
    const result = buildDescriptionExcerpt(prose);
    expect(result).toBe(
      'Customizable Action button and powerful camera system.'
    );
  });
});
