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

  it('accepts blockquote and four-space continuation lines', () => {
    expect(
      scanMarkdownReferenceDefinitions(
        '> [quoted]:\n>   https://cdn.example/quoted.png\n\n[r]:\n    https://cdn.example/indented.png'
      )
    ).toEqual([
      { destination: 'https://cdn.example/quoted.png', label: 'quoted' },
      { destination: 'https://cdn.example/indented.png', label: 'r' },
    ]);
  });

  it('accepts a two-space continuation recognized by Marked', () => {
    expect(
      scanMarkdownReferenceDefinitions(
        '[r]:\n  https://cdn.shopify.com/a.png\n![x][r]'
      )
    ).toEqual([{ destination: 'https://cdn.shopify.com/a.png', label: 'r' }]);
  });

  it.each([
    '<!--\ncomment\n-->\n[hero]: https://cdn.example/hero.png',
    '<script>\nwindow.example = true;\n</script>\n[hero]: https://cdn.example/hero.png',
  ])('accepts definitions after a multiline HTML block closes', (content) => {
    expect(scanMarkdownReferenceDefinitions(content)).toEqual([
      { destination: 'https://cdn.example/hero.png', label: 'hero' },
    ]);
  });

  it('accepts definitions nested under list markers', () => {
    expect(
      scanMarkdownReferenceDefinitions(
        '![x][r]\n\n- [r]: https://cdn.example/list.png'
      )
    ).toEqual([{ destination: 'https://cdn.example/list.png', label: 'r' }]);
  });

  it.each([
    '<?xml version="1.0"?>\n[hero]: https://cdn.example/pi.png',
    '<!DOCTYPE html>\n[hero]: https://cdn.example/doctype.png',
  ])('accepts definitions after declaration HTML blocks', (content) => {
    expect(scanMarkdownReferenceDefinitions(content)).toEqual([
      {
        destination: expect.stringContaining('https://cdn.example/'),
        label: 'hero',
      },
    ]);
  });
});
