import { describe, expect, it } from 'vitest';
import { escapeXml } from './xml-utils';

describe('escapeXml', () => {
  it('returns an empty string unchanged', () => {
    expect(escapeXml('')).toBe('');
  });

  it('escapes XML-reserved characters', () => {
    expect(escapeXml(`A&B <tag attr="value">'text'</tag>`)).toBe(
      'A&amp;B &lt;tag attr=&quot;value&quot;&gt;&apos;text&apos;&lt;/tag&gt;'
    );
  });

  it('escapes every reserved character in sequence', () => {
    expect(escapeXml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;');
  });

  it('escapes repeated consecutive reserved characters', () => {
    expect(escapeXml(`&&<<>>""''`)).toBe(
      '&amp;&amp;&lt;&lt;&gt;&gt;&quot;&quot;&apos;&apos;'
    );
  });

  it('escapes already escaped entities again', () => {
    expect(escapeXml('&amp;')).toBe('&amp;amp;');
  });

  it('leaves plain text unchanged', () => {
    expect(escapeXml('Plain product title 123')).toBe(
      'Plain product title 123'
    );
  });
});
