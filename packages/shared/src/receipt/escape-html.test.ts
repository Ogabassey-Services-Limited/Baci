import { describe, expect, it } from 'vitest';
import { escapeHtml, escapeJsString } from './escape-html';

describe('escapeHtml', () => {
  it('escapes HTML metacharacters', () => {
    expect(escapeHtml(`Tom & <Jerry> "quote" 'apostrophe'`)).toBe(
      'Tom &amp; &lt;Jerry&gt; &quot;quote&quot; &#039;apostrophe&#039;'
    );
  });
});

describe('escapeJsString', () => {
  it('escapes JS-sensitive characters for inline script contexts', () => {
    expect(escapeJsString(`a'b"c<d>e\\\n\r`)).toBe(
      `a\\'b\\"c\\x3Cd\\x3Ee\\\\\\n\\r`
    );
  });
});
