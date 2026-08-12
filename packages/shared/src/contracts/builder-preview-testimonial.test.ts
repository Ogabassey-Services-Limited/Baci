import { describe, expect, it } from 'vitest';
import { builderPreviewCandidateConfigSchema } from './builder-preview-candidate-config';

function testimonial(id: string, avatar: string) {
  return {
    props: {
      author: 'Ada Customer',
      avatar,
      id,
      quote: 'Reliable service and thoughtful support.',
      rating: 5,
      role: 'Verified customer',
    },
    type: 'Testimonial',
  };
}

describe('saved Testimonial avatar preview compatibility', () => {
  it('removes external avatars while retaining safe local avatar context', () => {
    const result = builderPreviewCandidateConfigSchema.safeParse({
      content: [
        testimonial('testimonial-root', 'https://cdn.example.test/avatar.webp'),
      ],
      root: { props: { title: 'Home' } },
      zones: {
        aside: [testimonial('testimonial-zone', '/avatars/customer.webp')],
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content[0]?.props).not.toHaveProperty('avatar');
      expect(result.data.zones).toEqual({
        aside: [
          {
            props: {
              author: 'Ada Customer',
              id: 'testimonial-zone',
              quote: 'Reliable service and thoughtful support.',
              rating: 5,
              role: 'Verified customer',
              avatar: '/avatars/customer.webp',
            },
            type: 'Testimonial',
          },
        ],
      });
      expect(JSON.stringify(result.data)).not.toContain('cdn.example.test');
    }
  });

  it('rejects unsafe or unreviewed Testimonial media fields', () => {
    const candidate = (props: Record<string, unknown>) =>
      builderPreviewCandidateConfigSchema.safeParse({
        content: [
          {
            ...testimonial('testimonial-1', '/avatars/customer.webp'),
            props,
          },
        ],
        root: { props: { title: 'Home' } },
      }).success;

    expect(
      candidate({
        ...testimonial('testimonial-1', '/avatars/customer.webp').props,
        avatar: 'javascript:alert(1)',
      })
    ).toBe(false);
    expect(
      candidate({
        ...testimonial('testimonial-1', '/avatars/customer.webp').props,
        avatarUrl: '/avatars/customer.webp',
      })
    ).toBe(false);
  });
});
