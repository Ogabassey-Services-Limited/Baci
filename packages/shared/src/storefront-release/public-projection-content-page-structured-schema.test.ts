import { describe, expect, it } from 'vitest';
import { StorefrontPublicContentPageStructuredSchema } from './public-projection-content-page-structured-schema';

describe('StorefrontPublicContentPageStructuredSchema', () => {
  it('preserves bounded About and FAQ structures', () => {
    const about = {
      kind: 'about',
      mission: 'Make commerce accessible.',
      values: ['Trust'],
    } as const;
    const faq = {
      items: [{ answer: 'Within 24 hours.', question: 'When do you ship?' }],
      kind: 'faq',
    } as const;
    expect(StorefrontPublicContentPageStructuredSchema.parse(about)).toEqual(
      about
    );
    expect(StorefrontPublicContentPageStructuredSchema.parse(faq)).toEqual(faq);
  });

  it('rejects signed media URLs and unbounded FAQ answers', () => {
    expect(
      StorefrontPublicContentPageStructuredSchema.safeParse({
        galleryUrls: ['https://cdn.example/image.png?token=secret'],
        kind: 'about',
      }).success
    ).toBe(false);
    expect(
      StorefrontPublicContentPageStructuredSchema.safeParse({
        items: [{ answer: 'a'.repeat(10_001), question: 'Question?' }],
        kind: 'faq',
      }).success
    ).toBe(false);
  });
});
