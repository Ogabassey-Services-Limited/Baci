import { sanitizePlainTextForHtml } from '@/lib/sanitize-plain-text';

describe('sanitizePlainTextForHtml', () => {
  it('leaves plain text without HTML-special characters unchanged', () => {
    expect(sanitizePlainTextForHtml('plain text 123')).toBe('plain text 123');
  });

  it('passes through punctuation that has no special HTML meaning', () => {
    expect(sanitizePlainTextForHtml('Plan #42: data_bundle-1GB/30days')).toBe(
      'Plan #42: data_bundle-1GB/30days'
    );
  });

  it('escapes user text for safe HTML interpolation', () => {
    expect(sanitizePlainTextForHtml('<token-123>')).toBe('&lt;token-123&gt;');
    expect(sanitizePlainTextForHtml('Tom & "Ada"')).toBe(
      'Tom &amp; &quot;Ada&quot;'
    );
    expect(sanitizePlainTextForHtml("O'Neil")).toBe('O&#039;Neil');
  });

  it('returns an empty string for unset input', () => {
    expect(sanitizePlainTextForHtml('')).toBe('');
    expect(sanitizePlainTextForHtml(null as unknown as string)).toBe('');
    expect(sanitizePlainTextForHtml(undefined as unknown as string)).toBe('');
  });
});
