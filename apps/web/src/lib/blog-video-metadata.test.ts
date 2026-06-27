import { describe, expect, it } from 'vitest';
import { buildBlogVideoMetadata } from './blog-video-metadata';

const baseInput = {
  content: '<p><a href="https://youtu.be/tp-AlU5FVpE?si=abc">Watch</a></p>',
  datePublished: '2026-06-25T08:00:00.000Z',
  description: 'Pixel 9 Pro Fold unboxing for buyers in Nigeria.',
  postUrl: 'https://ogabassey.com/blog/pixel-9-pro-fold-unboxing',
  publisherName: 'Ogabassey',
  title: 'Google Pixel 9 Pro Fold Unboxing',
};

describe('buildBlogVideoMetadata', () => {
  it('builds Google-compatible VideoObject metadata from a youtu.be link', () => {
    const metadata = buildBlogVideoMetadata(baseInput);

    expect(metadata?.video).toEqual({
      embedUrl: 'https://www.youtube-nocookie.com/embed/tp-AlU5FVpE',
      thumbnailUrl: 'https://i.ytimg.com/vi/tp-AlU5FVpE/hqdefault.jpg',
      title: 'Google Pixel 9 Pro Fold Unboxing',
      videoId: 'tp-AlU5FVpE',
      watchUrl: 'https://www.youtube.com/watch?v=tp-AlU5FVpE',
    });
    expect(metadata?.schema).toMatchObject({
      '@type': 'VideoObject',
      embedUrl: 'https://www.youtube-nocookie.com/embed/tp-AlU5FVpE',
      mainEntityOfPage: {
        '@id': 'https://ogabassey.com/blog/pixel-9-pro-fold-unboxing',
      },
      name: 'Google Pixel 9 Pro Fold Unboxing',
      thumbnailUrl: [
        'https://i.ytimg.com/vi/tp-AlU5FVpE/hqdefault.jpg',
        'https://i.ytimg.com/vi/tp-AlU5FVpE/maxresdefault.jpg',
      ],
      uploadDate: '2026-06-25T08:00:00.000Z',
      url: 'https://www.youtube.com/watch?v=tp-AlU5FVpE',
    });
  });

  it('supports watch, embed, shorts, and nested TipTap-style content links', () => {
    const metadata = buildBlogVideoMetadata({
      ...baseInput,
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                text: 'Video',
                marks: [
                  {
                    type: 'link',
                    attrs: {
                      href: 'https://www.youtube.com/watch?v=tp-AlU5FVpE&amp;t=7',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    expect(metadata?.video.videoId).toBe('tp-AlU5FVpE');

    const embedMetadata = buildBlogVideoMetadata({
      ...baseInput,
      content: 'https://www.youtube.com/embed/tp-AlU5FVpE',
    });
    const shortsMetadata = buildBlogVideoMetadata({
      ...baseInput,
      content: 'https://youtube.com/shorts/tp-AlU5FVpE',
    });

    expect(embedMetadata?.video.videoId).toBe('tp-AlU5FVpE');
    expect(shortsMetadata?.video.videoId).toBe('tp-AlU5FVpE');
  });

  it('detects mobile YouTube links and links near the bottom of long TipTap content', () => {
    const mobileMetadata = buildBlogVideoMetadata({
      ...baseInput,
      content: 'https://m.youtube.com/watch?v=tp-AlU5FVpE',
    });
    expect(mobileMetadata?.video.videoId).toBe('tp-AlU5FVpE');

    const longTipTapContent = {
      type: 'doc',
      content: [
        ...Array.from({ length: 160 }, (_, index) => ({
          type: 'paragraph',
          content: [{ type: 'text', text: `Paragraph ${index}` }],
        })),
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Watch the video',
              marks: [
                {
                  type: 'link',
                  attrs: { href: 'https://youtu.be/tp-AlU5FVpE' },
                },
              ],
            },
          ],
        },
      ],
    };

    const deepMetadata = buildBlogVideoMetadata({
      ...baseInput,
      content: longTipTapContent,
    });
    expect(deepMetadata?.video.videoId).toBe('tp-AlU5FVpE');
  });

  it('returns null when there is no valid YouTube video or upload date', () => {
    expect(
      buildBlogVideoMetadata({ ...baseInput, content: '<p>No video</p>' })
    ).toBeNull();
    expect(
      buildBlogVideoMetadata({ ...baseInput, datePublished: null })
    ).toBeNull();
  });

  it('sanitizes text and rejects unsafe post urls', () => {
    const metadata = buildBlogVideoMetadata({
      ...baseInput,
      description: '<strong>Great</strong> unboxing\nfor buyers',
      postUrl: 'javascript:alert(1)',
      title: '<em>Pixel</em> video',
    });

    expect(metadata).toBeNull();

    const safeMetadata = buildBlogVideoMetadata({
      ...baseInput,
      description: '<strong>Great</strong> unboxing\nfor buyers',
      title: '<em>Pixel</em> video',
    });

    expect(safeMetadata?.schema).toMatchObject({
      description: 'Great unboxing for buyers',
      name: 'Pixel video',
    });
  });
});
