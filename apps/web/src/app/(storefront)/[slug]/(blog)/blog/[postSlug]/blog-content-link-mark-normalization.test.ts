import { describe, expect, it } from 'vitest';
import { normalizeBlogContentLinks } from './blog-content-link-mark-normalization';

const OPTIONS = {
  baseUrl: 'https://ogabassey.com',
  merchantSlug: 'ogabassey',
};

function docWithLinkMark(attrs: Record<string, unknown>) {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Shop now',
            marks: [{ type: 'link', attrs }],
          },
        ],
      },
    ],
  };
}

function firstLinkAttrs(content: unknown): Record<string, unknown> {
  const doc = content as ReturnType<typeof docWithLinkMark>;
  return doc.content[0].content[0].marks[0].attrs;
}

describe('normalizeBlogContentLinks', () => {
  it('normalizes internal absolute hrefs to canonical relative paths', () => {
    // Arrange
    const doc = docWithLinkMark({
      href: 'https://ogabassey.com/phones/iphone-15?srsltid=tracking',
    });

    // Act
    const normalized = normalizeBlogContentLinks(doc, OPTIONS);

    // Assert
    expect(firstLinkAttrs(normalized).href).toBe('/smartphones/iphone-15');
  });

  it('strips nofollow from rel while keeping other tokens', () => {
    // Arrange
    const doc = docWithLinkMark({
      href: 'https://www.samsung.com/specs',
      rel: 'nofollow ugc noopener',
    });

    // Act
    const normalized = normalizeBlogContentLinks(doc, OPTIONS);

    // Assert
    expect(firstLinkAttrs(normalized).rel).toBe('ugc noopener');
  });

  it('drops rel entirely when nofollow was its only token', () => {
    // Arrange
    const doc = docWithLinkMark({
      href: 'https://www.samsung.com/specs',
      rel: 'nofollow',
    });

    // Act
    const normalized = normalizeBlogContentLinks(doc, OPTIONS);

    // Assert
    expect(firstLinkAttrs(normalized)).not.toHaveProperty('rel');
  });

  it('returns the same object identity when nothing changes', () => {
    // Arrange
    const doc = docWithLinkMark({ href: '/smartphones/iphone-15' });

    // Act
    const normalized = normalizeBlogContentLinks(doc, OPTIONS);

    // Assert
    expect(normalized).toBe(doc);
  });

  it('passes non-record content through untouched', () => {
    expect(normalizeBlogContentLinks('plain text', OPTIONS)).toBe('plain text');
    expect(normalizeBlogContentLinks(null, OPTIONS)).toBe(null);
  });
});
