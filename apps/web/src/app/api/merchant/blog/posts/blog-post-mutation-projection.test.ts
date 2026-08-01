import { describe, expect, it } from 'vitest';
import { BLOG_POST_MUTATION_PROJECTION } from './blog-post-mutation-projection';

describe('BLOG_POST_MUTATION_PROJECTION', () => {
  it('limits mutation responses to the merchant-safe blog post contract', () => {
    const databaseRecord = {
      category: 'commerce',
      content: '<p>Launch story</p>',
      embedding: [0.12, 0.34],
      excerpt: 'Launch story',
      featured_image_url: 'https://cdn.usebaci.com/cover.webp',
      id: 'post-1',
      internal_review_notes: 'not for clients',
      merchant_id: 'merchant-1',
      published_at: null,
      slug: 'launch-story',
      status: 'draft',
      title: 'Launch story',
    };
    const selectedRecord = Object.fromEntries(
      BLOG_POST_MUTATION_PROJECTION.split(', ').map((column) => [
        column,
        databaseRecord[column as keyof typeof databaseRecord],
      ])
    );

    expect(selectedRecord).toEqual({
      category: 'commerce',
      content: '<p>Launch story</p>',
      excerpt: 'Launch story',
      featured_image_url: 'https://cdn.usebaci.com/cover.webp',
      id: 'post-1',
      merchant_id: 'merchant-1',
      published_at: null,
      slug: 'launch-story',
      status: 'draft',
      title: 'Launch story',
    });
    expect(selectedRecord).not.toHaveProperty('embedding');
    expect(selectedRecord).not.toHaveProperty('internal_review_notes');
  });
});
