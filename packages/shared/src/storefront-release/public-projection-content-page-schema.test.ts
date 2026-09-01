import { describe, expect, it } from 'vitest';
import { StorefrontPublicContentPageSchema } from './public-projection-content-page-schema';

const validPage = {
  body: 'Public page',
  format: 'sanitized_markdown',
  id: '123e4567-e89b-42d3-a456-426614174011',
  slug: 'about',
  status: 'published',
  title: 'About',
} as const;

describe('StorefrontPublicContentPageSchema', () => {
  it('accepts release-safe Markdown content', () => {
    expect(StorefrontPublicContentPageSchema.parse(validPage)).toEqual(
      validPage
    );
  });

  it('rejects query-bearing URLs in published Markdown', () => {
    expect(
      StorefrontPublicContentPageSchema.safeParse({
        ...validPage,
        body: '[Download](https://example.test/export?token=secret)',
      }).success
    ).toBe(false);
  });

  it('does not interpret URLs in plain text as Markdown', () => {
    expect(
      StorefrontPublicContentPageSchema.safeParse({
        ...validPage,
        body: 'https://example.test/export?token=secret',
        format: 'plain_text',
      }).success
    ).toBe(true);
  });
});
