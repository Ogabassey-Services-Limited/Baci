import { describe, expect, it } from 'vitest';
import { sanitizeHtmlToPlainText } from './sanitize-html-text';

describe('sanitizeHtmlToPlainText', () => {
  it('strips tags, decodes common entities, and normalizes whitespace', () => {
    expect(
      sanitizeHtmlToPlainText(
        '<p>Returns&nbsp;&amp;&nbsp;<strong>exchanges</strong></p>'
      )
    ).toBe('Returns & exchanges');
  });

  it('removes null bytes and caps the output length', () => {
    expect(sanitizeHtmlToPlainText(`abc\0${'x'.repeat(10)}`, 6)).toBe('abcxxx');
  });

  it('returns an empty string for missing input', () => {
    expect(sanitizeHtmlToPlainText(null)).toBe('');
    expect(sanitizeHtmlToPlainText(undefined)).toBe('');
    expect(sanitizeHtmlToPlainText('')).toBe('');
  });

  it('strips oversized tags that exceed the bounded regex length', () => {
    expect(sanitizeHtmlToPlainText(`<img src="${'x'.repeat(1200)}">safe`)).toBe(
      'safe'
    );
  });

  it('neutralizes malformed nested tags until stable', () => {
    expect(sanitizeHtmlToPlainText('<<script>>alert(1)<</script>>')).toBe(
      'alert(1)'
    );
  });

  it('keeps the default max length when no cap is provided', () => {
    const value = 'x'.repeat(10_001);

    expect(sanitizeHtmlToPlainText(value)).toHaveLength(10_000);
  });

  it('decodes escaped tags as plain text characters', () => {
    expect(
      sanitizeHtmlToPlainText('&lt;script&gt;alert(1)&lt;/script&gt;')
    ).toBe('<script>alert(1)</script>');
  });
});
