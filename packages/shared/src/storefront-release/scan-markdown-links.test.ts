import { describe, expect, it } from 'vitest';
import { scanMarkdownLinks } from './scan-markdown-links';

describe('scanMarkdownLinks', () => {
  it('keeps image reference labels separate from ordinary links', () => {
    const result = scanMarkdownLinks(
      '![Hero][hero] [Read more](https://example.test/about)\n\n[hero]: /release-assets/hash.png'
    );

    expect(result.imageReferenceLabels).toEqual(new Set(['hero']));
    expect(result.referenceDefinitions).toEqual([
      { destination: '/release-assets/hash.png', label: 'hero' },
    ]);
    expect(result.destinations).toEqual([
      { destination: 'https://example.test/about', image: false },
    ]);
  });

  it('recognizes definitions after block boundaries', () => {
    expect(
      scanMarkdownLinks('Heading\n===\n[hero]: https://example.test/hero.png')
        .referenceDefinitions
    ).toEqual([
      { destination: 'https://example.test/hero.png', label: 'hero' },
    ]);
  });
});
