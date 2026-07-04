import { describe, expect, it, vi } from 'vitest';

const { mockIsTrusted, mockIsLegacy } = vi.hoisted(() => ({
  mockIsTrusted: vi.fn(),
  mockIsLegacy: vi.fn(),
}));

vi.mock('@/lib/blog-inline-image-optimization', () => ({
  isTrustedCdnInlineImage: (...args: unknown[]) => mockIsTrusted(...args),
  isLegacyOgabasseyCdnBlogImage: (...args: unknown[]) => mockIsLegacy(...args),
}));

import { findFirstTrustedInlineImage } from './blog-priority-inline-image';

const IMAGE_SRC = 'https://cdn.ogabassey.com/blog/inline/photo.png';

function docWithImage(src: string) {
  return {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'intro' }] },
      { type: 'image', attrs: { src } },
    ],
  };
}

describe('findFirstTrustedInlineImage', () => {
  it('returns the first trusted inline image with its node path', () => {
    mockIsLegacy.mockReturnValue(false);
    mockIsTrusted.mockReturnValue(true);

    expect(findFirstTrustedInlineImage(docWithImage(IMAGE_SRC), '0')).toEqual({
      src: IMAGE_SRC,
      nodePath: '0.1',
    });
  });

  it('returns null when the first image is not a trusted inline image', () => {
    mockIsLegacy.mockReturnValue(false);
    mockIsTrusted.mockReturnValue(false);

    expect(
      findFirstTrustedInlineImage(docWithImage(IMAGE_SRC), '0')
    ).toBeNull();
  });

  it('returns null when the first image does not match the target src', () => {
    mockIsLegacy.mockReturnValue(false);
    mockIsTrusted.mockReturnValue(true);

    expect(
      findFirstTrustedInlineImage(
        docWithImage(IMAGE_SRC),
        '0',
        'https://cdn.ogabassey.com/blog/inline/other.png'
      )
    ).toBeNull();
  });

  it('returns null for documents without images', () => {
    mockIsLegacy.mockReturnValue(false);
    mockIsTrusted.mockReturnValue(true);

    expect(
      findFirstTrustedInlineImage(
        { type: 'doc', content: [{ type: 'paragraph' }] },
        '0'
      )
    ).toBeNull();
  });
});
