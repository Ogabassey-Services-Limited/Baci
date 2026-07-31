import { describe, expect, it, vi } from 'vitest';
import { blogPostSchema, createPostSchema } from './blog';

vi.mock('@/lib/sanitize', () => ({
  sanitizeHtml: (html: string) => html,
}));

describe('embedded blog products validation', () => {
  it('rejects more than twenty embedded products for create and update payloads', () => {
    const embeddedProducts = Array.from(
      { length: 21 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`
    );
    const createPayload = {
      title: 'Post with products',
      slug: 'post-with-products',
      content: '<p>Content</p>',
      author_name: 'Author',
      embedded_products: embeddedProducts,
    };

    const atLimitPayload = {
      ...createPayload,
      embedded_products: embeddedProducts.slice(0, 20),
    };

    expect(blogPostSchema.safeParse(atLimitPayload).success).toBe(true);
    expect(createPostSchema.safeParse(atLimitPayload).success).toBe(true);
    expect(blogPostSchema.safeParse(createPayload).success).toBe(false);
    expect(createPostSchema.safeParse(createPayload).success).toBe(false);
  });
});
