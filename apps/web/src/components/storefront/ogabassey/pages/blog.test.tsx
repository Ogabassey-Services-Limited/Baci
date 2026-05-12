import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OgabasseyV2Blog } from './blog';

// Mock next/image to inspect props passed to it
vi.mock('next/image', () => ({
  default: ({ src, alt, priority, loading, fill, sizes, fetchPriority, ...props }: any) => (
    <img
      src={src}
      alt={alt}
      data-priority={priority ? 'true' : 'false'}
      data-loading={loading}
      data-fill={fill ? 'true' : 'false'}
      data-fetchpriority={fetchPriority}
      data-testid="next-image"
      {...props}
    />
  ),
}));

// Mock hooks
vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: () => ({ basePath: '/test-store' }),
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock ad unit
vi.mock('./ad-unit', () => ({
  AdUnit: () => <div data-testid="ad-unit" />,
}));

describe('OgabasseyV2Blog', () => {
  const mockPosts: any[] = [
    {
      id: '1',
      title: 'Featured Post',
      slug: 'featured-post',
      featured: true,
      featured_image_url: 'https://example.com/featured.jpg',
      published_at: '2023-01-01',
      category: 'Tech News',
      excerpt: 'Featured excerpt',
      content: 'Featured content',
    },
    {
      id: '2',
      title: 'Regular Post',
      slug: 'regular-post',
      featured: false,
      featured_image_url: 'https://example.com/regular.jpg',
      published_at: '2023-01-02',
      category: 'Reviews',
      excerpt: 'Regular excerpt',
      content: 'Regular content',
    },
  ];

  it('renders featured post with HeroImage (high priority)', () => {
    render(<OgabasseyV2Blog posts={mockPosts} />);

    const images = screen.getAllByTestId('next-image');
    // First image should be the featured one (HeroImage)
    const featuredImage = images.find(img => img.getAttribute('src') === 'https://example.com/featured.jpg');

    expect(featuredImage).toBeInTheDocument();
    // HeroImage sets isLCP=true -> priority=true
    expect(featuredImage).toHaveAttribute('data-priority', 'true');
    // HeroImage sets fetchPriority="high"
    expect(featuredImage).toHaveAttribute('data-fetchpriority', 'high');
    // We added fill={true}
    expect(featuredImage).toHaveAttribute('data-fill', 'true');
  });

  it('renders grid posts with ProductCardImage (lazy loading)', () => {
    render(<OgabasseyV2Blog posts={mockPosts} />);

    const images = screen.getAllByTestId('next-image');
    // Find the grid image
    const gridImage = images.find(img => img.getAttribute('src') === 'https://example.com/regular.jpg');

    expect(gridImage).toBeInTheDocument();
    // ProductCardImage sets loading="lazy"
    expect(gridImage).toHaveAttribute('data-loading', 'lazy');
    // ProductCardImage sets fetchPriority="low"
    expect(gridImage).toHaveAttribute('data-fetchpriority', 'low');
    // We added fill={true}
    expect(gridImage).toHaveAttribute('data-fill', 'true');
  });
});
