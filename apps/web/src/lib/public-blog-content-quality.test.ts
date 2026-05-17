import { describe, expect, it } from 'vitest';
import {
  filterPublicBlogCategories,
  filterPublicBlogPosts,
  isPublicBlogCategory,
  isPublicBlogPost,
} from '@/lib/public-blog-content-quality';

describe('public blog content quality filters', () => {
  it('keeps normal public blog categories and removes junk taxonomy values', () => {
    expect(
      filterPublicBlogCategories([
        'Smartphones',
        ' Laptops ',
        'gcrblw',
        'test',
        'AI',
        '',
        'Smartphones',
      ])
    ).toEqual(['Smartphones', 'Laptops', 'AI']);

    expect(isPublicBlogCategory('Smartphones')).toBe(true);
    expect(isPublicBlogCategory('gcrblw')).toBe(false);
  });

  it('deduplicates categories case-insensitively and removes missing values', () => {
    expect(
      filterPublicBlogCategories([
        'Technology',
        'technology',
        'TECHNOLOGY',
        null,
        undefined,
        'Buying Guides',
      ])
    ).toEqual(['Technology', 'Buying Guides']);
  });

  it('rejects likely random vowel-free category tokens', () => {
    expect(isPublicBlogCategory('bcdfg')).toBe(false);
    expect(isPublicBlogCategory('qwrtyp')).toBe(false);
    expect(isPublicBlogCategory('bcdf')).toBe(true);
  });

  it('removes explicit test and agent-integration posts from public surfaces', () => {
    const posts = [
      {
        id: 'post-1',
        slug: 'android-17-buying-guide',
        title: 'Android 17 Buying Guide',
      },
      {
        id: 'post-2',
        slug: 'merchant-editor-smoke-check',
        title: 'Test Post: Agent Integration Working',
      },
      {
        id: 'post-3',
        slug: 'agent-integration-working',
        title: 'Merchant editor smoke check',
      },
    ];

    expect(filterPublicBlogPosts(posts)).toEqual([posts[0]]);
    expect(isPublicBlogPost(posts[0])).toBe(true);
    expect(isPublicBlogPost(posts[1])).toBe(false);
    expect(isPublicBlogPost(posts[2])).toBe(false);
  });

  it('treats missing title or slug as unsuitable for public discovery surfaces', () => {
    expect(isPublicBlogPost({ title: 'Useful buying guide', slug: '' })).toBe(
      false
    );
    expect(isPublicBlogPost({ title: '', slug: 'useful-buying-guide' })).toBe(
      false
    );
    expect(isPublicBlogPost({ title: 'Useful buying guide', slug: null })).toBe(
      false
    );
    expect(
      isPublicBlogPost({ title: 'Useful buying guide', slug: undefined })
    ).toBe(false);
    expect(isPublicBlogPost({ title: null, slug: 'useful-buying-guide' })).toBe(
      false
    );
    expect(
      isPublicBlogPost({ title: undefined, slug: 'useful-buying-guide' })
    ).toBe(false);
  });
});
