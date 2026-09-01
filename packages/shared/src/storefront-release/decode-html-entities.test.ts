import { describe, expect, it } from 'vitest';
import { decodeHtmlEntities } from './decode-html-entities';

describe('decodeHtmlEntities', () => {
  it('decodes named and numeric HTML references', () => {
    expect(decodeHtmlEntities('/foo&sol;..&sol;admin')).toBe('/foo/../admin');
    expect(decodeHtmlEntities('a&amp;b&#x2f;c')).toBe('a&b/c');
  });

  it('leaves unknown references unchanged', () => {
    expect(decodeHtmlEntities('/foo&not-a-real-entity;')).toBe(
      '/foo&not-a-real-entity;'
    );
  });
});
