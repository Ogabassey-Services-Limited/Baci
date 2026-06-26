import { describe, expect, it } from 'vitest';
import { sanitizeHtml } from '@/lib/sanitize';

describe('sanitize heading hierarchy normalization', () => {
  it('normalizes article body headings without skipping levels below the page h1', () => {
    const output = sanitizeHtml(
      '<h2>Buying advice</h2><h4>Battery checks</h4><h1>Duplicate imported title</h1><h3>Camera details</h3>',
      { normalizeHeadingHierarchy: true }
    );

    expect(output).toBe(
      '<h2>Buying advice</h2><h3>Battery checks</h3><h2>Duplicate imported title</h2><h3>Camera details</h3>'
    );
  });

  it('keeps repeated skipped sibling headings at the same normalized level', () => {
    const output = sanitizeHtml(
      '<h2>Main section</h2><h4>First sibling</h4><h4>Second sibling</h4>',
      { normalizeHeadingHierarchy: true }
    );

    expect(output).toBe(
      '<h2>Main section</h2><h3>First sibling</h3><h3>Second sibling</h3>'
    );
  });

  it('promotes all top-level body headings when content starts at h3', () => {
    const output = sanitizeHtml(
      '<h3>Battery</h3><h3>Camera</h3><h4>Low-light notes</h4>',
      { normalizeHeadingHierarchy: true }
    );

    expect(output).toBe(
      '<h2>Battery</h2><h2>Camera</h2><h3>Low-light notes</h3>'
    );
  });

  it('preserves valid deeper legacy heading levels', () => {
    const output = sanitizeHtml(
      '<h2>Section</h2><h3>Topic</h3><h4>Detail</h4><h5>Fine print</h5>',
      { normalizeHeadingHierarchy: true }
    );

    expect(output).toBe(
      '<h2>Section</h2><h3>Topic</h3><h4>Detail</h4><h5>Fine print</h5>'
    );
  });

  it('normalizes the first visible heading even when a later h2 exists', () => {
    const output = sanitizeHtml(
      '<h3>Intro</h3><p>Copy</p><h2>Specs</h2><h3>Battery</h3>',
      { normalizeHeadingHierarchy: true }
    );

    expect(output).toBe(
      '<h2>Intro</h2><p>Copy</p><h2>Specs</h2><h3>Battery</h3>'
    );
  });

  it('keeps subsections nested under imported h1 titles', () => {
    const output = sanitizeHtml(
      '<h1>Imported title</h1><h2>Specs</h2><h2>Pricing</h2>',
      { normalizeHeadingHierarchy: true }
    );

    expect(output).toBe(
      '<h2>Imported title</h2><h3>Specs</h3><h3>Pricing</h3>'
    );
  });
});
