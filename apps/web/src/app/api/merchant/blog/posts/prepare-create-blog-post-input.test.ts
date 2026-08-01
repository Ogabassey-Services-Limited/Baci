import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/sanitize', () => ({
  sanitizeHtml: (html: string) => html,
}));

const { prepareCreateBlogPostInput } = await import(
  './prepare-create-blog-post-input'
);

describe('prepareCreateBlogPostInput', () => {
  it('normalizes defaults before validating a valid request body', () => {
    const result = prepareCreateBlogPostInput({
      title: 'New Blog Post',
      content: '<p>Post body</p>',
    });

    expect(result.validation.success).toBe(true);
    if (result.validation.success) {
      expect(result.validation.data).toMatchObject({
        author_name: 'Store Owner',
        slug: 'new-blog-post',
      });
    }
  });

  it('returns a Zod error for an invalid request body', () => {
    const result = prepareCreateBlogPostInput({ content: '<p>Post body</p>' });

    expect(result.validation.success).toBe(false);
  });
});
