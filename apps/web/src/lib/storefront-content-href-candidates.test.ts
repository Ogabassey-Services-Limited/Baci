import { describe, expect, it } from 'vitest';
import { collectHrefCandidates } from '@/lib/storefront-content-href-candidates';

describe('collectHrefCandidates', () => {
  it('collects quoted and unquoted href attributes', () => {
    const html =
      '<a href="/blog/quoted-post">A</a><a href=/blog/unquoted-post>B</a>';

    expect(collectHrefCandidates(html)).toEqual(
      expect.arrayContaining(['/blog/quoted-post', '/blog/unquoted-post'])
    );
  });

  it('collects inline, reference, autolink and bare markdown destinations', () => {
    const markdown = [
      'Inline [a](/blog/inline-post "title") and [b][ref].',
      '',
      '[ref]: </blog/reference-post>',
      'Auto <https://ogabassey.com/blog/auto-post> plus bare',
      'https://ogabassey.com/blog/bare-post.',
    ].join('\n');

    const candidates = collectHrefCandidates(markdown);

    expect(candidates).toEqual(
      expect.arrayContaining([
        '/blog/inline-post',
        '/blog/reference-post',
        'https://ogabassey.com/blog/auto-post',
        'https://ogabassey.com/blog/bare-post',
      ])
    );
  });

  it('strips angle brackets and trailing sentence punctuation', () => {
    const candidates = collectHrefCandidates(
      'See https://ogabassey.com/blog/punctuated-post!'
    );

    expect(candidates).toContain('https://ogabassey.com/blog/punctuated-post');
    expect(candidates).not.toContain(
      'https://ogabassey.com/blog/punctuated-post!'
    );
  });

  it('returns an empty list for content without links', () => {
    expect(collectHrefCandidates('plain prose, no links here')).toEqual([]);
  });
});
