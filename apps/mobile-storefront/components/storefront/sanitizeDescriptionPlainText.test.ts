/**
 * Tests for the standalone `sanitizeDescriptionPlainText` utility.
 */
import { sanitizeDescriptionPlainText } from '@/components/storefront/utils/text';

describe('sanitizeDescriptionPlainText', () => {
  it('returns empty string for empty, null, and undefined runtime values', () => {
    expect(sanitizeDescriptionPlainText('')).toBe('');
    expect(sanitizeDescriptionPlainText(null as unknown as string)).toBe('');
    expect(sanitizeDescriptionPlainText(undefined as unknown as string)).toBe(
      ''
    );
  });

  it('escapes individual special characters', () => {
    expect(sanitizeDescriptionPlainText('Tom & Jerry')).toBe('Tom &amp; Jerry');
    expect(sanitizeDescriptionPlainText('1 < 2')).toBe('1 &lt; 2');
    expect(sanitizeDescriptionPlainText('2 > 1')).toBe('2 &gt; 1');
    expect(sanitizeDescriptionPlainText('Say "hello"')).toBe(
      'Say &quot;hello&quot;'
    );
    expect(sanitizeDescriptionPlainText("it's fine")).toBe('it&#039;s fine');
  });

  it('escapes mixed HTML-like content', () => {
    expect(sanitizeDescriptionPlainText('<b>bold</b>')).toBe(
      '&lt;b&gt;bold&lt;/b&gt;'
    );
    expect(sanitizeDescriptionPlainText('<script>alert("XSS")</script>')).toBe(
      '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
    );
  });

  it('double-escapes already-escaped entities by design', () => {
    expect(sanitizeDescriptionPlainText('cats &amp; dogs')).toBe(
      'cats &amp;amp; dogs'
    );
    expect(sanitizeDescriptionPlainText('&lt;')).toBe('&amp;lt;');
    expect(sanitizeDescriptionPlainText('&gt;')).toBe('&amp;gt;');
  });
});
