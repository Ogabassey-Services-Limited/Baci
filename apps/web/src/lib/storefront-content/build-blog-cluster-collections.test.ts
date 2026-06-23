import { describe, expect, it } from 'vitest';
import { buildBlogClusterCollections } from './build-blog-cluster-collections';

const publishedGuidePosts = [
  {
    slug: 'best-phones-in-nigeria',
    title: 'Best Phones in Nigeria',
    excerpt: 'Budget and flagship phone picks.',
    category: 'Smartphones',
    tags: ['smartphones', 'budget', 'iphone'],
    keywords: ['android', 'battery'],
    featured_image_url: null,
    published_at: '2026-04-10T09:00:00.000Z',
    reading_time_minutes: 6,
  },
  {
    slug: 'apple-vs-samsung-buying-guide',
    title: 'Apple vs Samsung Buying Guide',
    excerpt: 'Which ecosystem fits you.',
    category: 'Smartphones',
    tags: ['smartphones', 'apple', 'samsung'],
    keywords: ['iphone', 'galaxy'],
    featured_image_url: null,
    published_at: '2026-04-09T09:00:00.000Z',
    reading_time_minutes: 5,
  },
  {
    slug: 'best-laptops-in-nigeria',
    title: 'Best Laptops in Nigeria',
    excerpt: 'Work and gaming laptop picks.',
    category: 'Laptops',
    tags: ['laptops', 'hp', 'dell'],
    keywords: ['ssd', 'ram'],
    featured_image_url: null,
    published_at: '2026-04-08T09:00:00.000Z',
    reading_time_minutes: 7,
  },
  {
    slug: 'student-laptop-buying-guide',
    title: 'Student Laptop Buying Guide',
    excerpt: 'What to buy for school and office work.',
    category: 'Laptops',
    tags: ['laptops', 'student'],
    keywords: ['budget', 'office'],
    featured_image_url: null,
    published_at: '2026-04-07T09:00:00.000Z',
    reading_time_minutes: 5,
  },
  {
    slug: 'best-smart-tvs-in-nigeria',
    title: 'Best Smart TVs in Nigeria',
    excerpt: 'Living-room and home-theater picks.',
    category: 'Smart TVs',
    tags: ['smart tvs', 'lg', 'samsung'],
    keywords: ['4k', 'hdr'],
    featured_image_url: null,
    published_at: '2026-04-06T09:00:00.000Z',
    reading_time_minutes: 6,
  },
  {
    slug: 'smart-tv-buying-guide',
    title: 'Smart TV Buying Guide',
    excerpt: 'How to choose screen size and panel type.',
    category: 'Smart TVs',
    tags: ['smart tvs', 'television'],
    keywords: ['oled', 'qled'],
    featured_image_url: null,
    published_at: '2026-04-05T09:00:00.000Z',
    reading_time_minutes: 5,
  },
];

describe('buildBlogClusterCollections', () => {
  it('groups published guides into smartphones, laptops, and smart-tv collections', () => {
    const collections = buildBlogClusterCollections({
      storeUrl: 'https://ogabassey.com',
      posts: publishedGuidePosts,
    });

    expect(collections.map((section) => section.categorySlug)).toEqual([
      'smartphones',
      'laptops',
      'smart-tvs',
    ]);
  });

  it('drops categories with fewer than two matching posts', () => {
    const collections = buildBlogClusterCollections({
      storeUrl: 'https://ogabassey.com',
      posts: publishedGuidePosts.slice(0, 3),
    });

    expect(collections.map((section) => section.categorySlug)).toEqual([
      'smartphones',
    ]);
  });

  it('keeps each collection sorted by newest guide and capped at three links', () => {
    const collections = buildBlogClusterCollections({
      storeUrl: 'https://ogabassey.com',
      posts: [
        ...publishedGuidePosts,
        {
          slug: 'android-phone-buying-guide',
          title: 'Android Phone Buying Guide',
          excerpt: 'Android options by budget.',
          category: 'Smartphones',
          tags: ['smartphones', 'android'],
          keywords: ['battery', 'camera'],
          featured_image_url: null,
          published_at: '2026-04-11T09:00:00.000Z',
          reading_time_minutes: 6,
        },
        {
          slug: 'used-iphone-buying-guide',
          title: 'Used iPhone Buying Guide',
          excerpt: 'Used iPhone checks.',
          category: 'Smartphones',
          tags: ['smartphones', 'iphone'],
          keywords: ['used', 'battery health'],
          featured_image_url: null,
          published_at: '2026-04-12T09:00:00.000Z',
          reading_time_minutes: 5,
        },
      ],
    });

    expect(
      collections
        .find((section) => section.categorySlug === 'smartphones')
        ?.guides.map((guide) => guide.href)
    ).toEqual([
      'https://ogabassey.com/blog/used-iphone-buying-guide',
      'https://ogabassey.com/blog/android-phone-buying-guide',
      'https://ogabassey.com/blog/best-phones-in-nigeria',
    ]);
  });
});
