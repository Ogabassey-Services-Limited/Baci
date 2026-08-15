import { describe, expect, it } from 'vitest';
import { buildDescriptionExcerpt } from './build-description-excerpt';

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

  it('falls through to second paragraph when "Why Worth" paragraph contains only specification sentences', () => {
    const html =
      '<h2>Why It Is Worth Buying</h2><p>Storage: 2TB PCIe NVMe SSD. RAM: 64GB.</p><p>Built for reliable all-day performance and intense creative workflows.</p>';
    const result = buildDescriptionExcerpt(html);
    expect(result).toBe(
      'Built for reliable all-day performance and intense creative workflows.'
    );
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

  it('falls through to plain text when second paragraph contains only specification sentences', () => {
    const html =
      '<p>Storage: 1TB NVMe. RAM: 16GB. Condition: Open Box.</p><p>Storage: 1TB. RAM: 16GB.</p>Engineered for maximum portability with long battery endurance.';
    const result = buildDescriptionExcerpt(html);
    expect(result).toBe(
      'Engineered for maximum portability with long battery endurance.'
    );
  });

  it('preserves feature-heading prose lines that are not raw specs', () => {
    const html =
      '<h2>Why It is Worth Buying</h2><p>Camera: Capture every detail in vivid color, day or night.</p>';
    const result = buildDescriptionExcerpt(html);
    expect(result).toBe(
      'Camera: Capture every detail in vivid color, day or night.'
    );
  });

  it('preserves feature prose using common verbs outside a hardcoded allowlist', () => {
    const html =
      '<h2>Why It is Worth Buying</h2><p>Display: See every detail on the expansive screen with brilliant clarity.</p>';
    const result = buildDescriptionExcerpt(html);
    expect(result).toBe(
      'Display: See every detail on the expansive screen with brilliant clarity.'
    );
  });

  it('preserves short concise single-sentence plain-text descriptions', () => {
    const description = 'Premium quality for everyday use.';
    const result = buildDescriptionExcerpt(description);
    expect(result).toBe('Premium quality for everyday use.');
  });

  it('preserves leading marketing prose before specification sentences in plain text', () => {
    const description =
      'Built for reliable all-day performance. Storage: 2TB. RAM: 64GB.';
    const result = buildDescriptionExcerpt(description);
    expect(result).toBe('Built for reliable all-day performance.');
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
    expect(result.length).toBe(203);
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
