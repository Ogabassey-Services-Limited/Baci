import { describe, expect, it } from 'vitest';
import {
  ensureBlogImageAltText,
  transformImageTitlesToFigureCaptions,
  unescapeHtmlText,
} from './blog-post-image-html';

describe('blog post image HTML helpers', () => {
  it('injects safe fallback alt text when legacy images omit alt', () => {
    expect(
      ensureBlogImageAltText('<p><img /></p>', "What's New & Notable")
    ).toContain('alt="What&#39;s New &amp; Notable"');
  });

  it('converts standalone titled images into figures with escaped captions', () => {
    expect(
      transformImageTitlesToFigureCaptions(
        '<p><img src="https://cdn.example.com/photo.jpg" title="&lt;script&gt;caption" /></p>'
      )
    ).toBe(
      '<figure><img src="https://cdn.example.com/photo.jpg" /><figcaption>&lt;script&gt;caption</figcaption></figure>'
    );
  });

  it('decodes known HTML entities before caption escaping', () => {
    expect(unescapeHtmlText('&copy; &mdash;')).toBe('\u00a9 \u2014');
  });
});
