import sanitizeLib from 'sanitize-html';
import { describe, expect, it } from 'vitest';
import {
  createSanitizeHtmlOptions,
  stripDisallowedRawTextBlocks,
} from '@/lib/sanitize-html-config';

describe('sanitize HTML config', () => {
  it('strips raw text blocks before sanitize-html parses allowed neighbors', () => {
    const sanitized = sanitizeLib(
      stripDisallowedRawTextBlocks(
        '<p>Keep</p><script><img src=x onerror=alert(1)></script>'
      ),
      createSanitizeHtmlOptions()
    );

    expect(sanitized).toBe('<p>Keep</p>');
  });

  it('keeps trusted priority images and removes untrusted priority markers', () => {
    const trustedImage =
      'https://cdn.ogabassey.com/core-assets/blog/x/inline-1-b9244d7a754d.png';
    const sanitized = sanitizeLib(
      `<img src="${trustedImage}" alt="Hero" data-baci-priority-image="true" fetchpriority="high"><img src="https://example.com/body.jpg" fetchpriority="high">`,
      createSanitizeHtmlOptions({
        trustedPriorityImageSources: [trustedImage],
      })
    );

    expect(sanitized).toContain('fetchpriority="high"');
    expect(sanitized).not.toContain('data-baci-priority-image');
    expect(sanitized).not.toContain('body.jpg" fetchpriority');
  });

  it('unwraps technical resource anchors when SEO anchor normalization is enabled', () => {
    const sanitized = sanitizeLib(
      '<p><a href="/_next/image?url=https%3A%2F%2Fexample.com%2Fphone.avif">Phone image</a></p>',
      createSanitizeHtmlOptions({ normalizeSeoAnchors: true })
    );

    expect(sanitized).toBe('<p>Phone image</p>');
  });
});
