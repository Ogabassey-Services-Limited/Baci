import { sanitizePlainTextForHtml } from '@/lib/sanitize-plain-text';

describe('sanitizePlainTextForHtml', () => {
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
