import { describe, expect, it } from 'vitest';
import { scanMarkdownLinkSyntax } from './scan-markdown-link-syntax';

describe('scanMarkdownLinkSyntax', () => {
  it('records nested image destinations without swallowing the outer link', () => {
    expect(
      scanMarkdownLinkSyntax('[![Hero](https://cdn.example/hero.png)](/about)')
    ).toEqual({
      destinations: [
        { destination: 'https://cdn.example/hero.png', image: true },
        { destination: '/about', image: false },
      ],
      imageReferenceLabels: new Set(),
    });
  });
});
