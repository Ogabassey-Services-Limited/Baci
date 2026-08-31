import { describe, expect, it } from 'vitest';
import { scanMarkdownReferenceDefinitions } from './scan-markdown-reference-definitions';

describe('scanMarkdownReferenceDefinitions', () => {
  it('accepts blockquote definitions after a blank quote line', () => {
    expect(
      scanMarkdownReferenceDefinitions(
        '> ![Hero][hero]\n>\n> [hero]: https://cdn.example/hero.png'
      )
    ).toEqual([{ destination: 'https://cdn.example/hero.png', label: 'hero' }]);
  });
});
