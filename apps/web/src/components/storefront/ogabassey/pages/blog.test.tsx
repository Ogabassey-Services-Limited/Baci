import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OgabasseyV2Blog, type BlogPost } from './blog';

// Mock next/image to inspect props passed to it
interface MockNextImageProps {
  alt: string;
  blurDataURL?: string;
  fetchPriority?: 'high' | 'low' | 'auto';
  fill?: boolean;
  loading?: 'eager' | 'lazy';
  placeholder?: 'blur' | 'empty';
  preload?: boolean;
  priority?: boolean;
  sizes?: string;
  src: string;
  [key: string]: unknown;
}

vi.mock('next/image', () => ({
  default: ({
    src,
    alt,
    preload,
    priority,
    loading,
    fill,
    sizes,
    fetchPriority,
    blurDataURL: _blurDataURL,
    placeholder: _placeholder,
    ...props
  }: MockNextImageProps) => (
    <img
      src={src}
      alt={alt}
      data-preload={preload ? 'true' : 'false'}
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
  default: ({ children }: { children: ReactNode }) => children,
}));

// Mock ad unit
vi.mock('./ad-unit', () => ({
  AdUnit: () => <div data-testid="ad-unit" />,
}));

describe('OgabasseyV2Blog', () => {
  const mockPosts: BlogPost[] = [
    {
      id: '1',
      title: 'Featured Post',
      slug: 'featured-post',
      featured: true,
      featured_image_url: 'https://example.com/featured.jpg',
      author_name: 'Ogabassey Team',
      published_at: '2023-01-01',
      category: 'Tech News',
      excerpt: 'Featured excerpt',
      reading_time_minutes: 4,
    },
    {
      id: '2',
      title: 'Regular Post',
      slug: 'regular-post',
      featured: false,
      featured_image_url: 'https://example.com/regular.jpg',
      author_name: 'Ogabassey Team',
      published_at: '2023-01-02',
      category: 'Reviews',
      excerpt: 'Regular excerpt',
      reading_time_minutes: 3,
    },
  ];

  it('renders featured post with HeroImage (high priority)', () => {
    render(<OgabasseyV2Blog posts={mockPosts} />);

    const images = screen.getAllByTestId('next-image');
    // First image should be the featured one (HeroImage)
    const featuredImage = images.find(
      (img) => img.getAttribute('src') === 'https://example.com/featured.jpg'
    );

    expect(featuredImage).toBeInTheDocument();
    // HeroImage maps legacy priority semantics to Next 16 `preload`.
    expect(featuredImage).toHaveAttribute('data-preload', 'true');
    expect(featuredImage).toHaveAttribute('data-priority', 'false');
    // HeroImage sets fetchPriority="high"
    expect(featuredImage).toHaveAttribute('data-fetchpriority', 'high');
    // We added fill={true}
    expect(featuredImage).toHaveAttribute('data-fill', 'true');
  });

  it('renders grid posts with ProductCardImage (lazy loading)', () => {
    render(<OgabasseyV2Blog posts={mockPosts} />);

    const images = screen.getAllByTestId('next-image');
    // Find the grid image
    const gridImage = images.find(
      (img) => img.getAttribute('src') === 'https://example.com/regular.jpg'
    );

    expect(gridImage).toBeInTheDocument();
    // ProductCardImage sets loading="lazy"
    expect(gridImage).toHaveAttribute('data-loading', 'lazy');
    // ProductCardImage sets fetchPriority="low"
    expect(gridImage).toHaveAttribute('data-fetchpriority', 'low');
    // We added fill={true}
    expect(gridImage).toHaveAttribute('data-fill', 'true');
  });

  it('renders UTC-stable date labels to avoid hydration drift', () => {
    render(
      <OgabasseyV2Blog
        posts={[
          {
            ...mockPosts[0],
            id: 'timezone-boundary-post',
            published_at: '2026-03-28T23:30:00.000Z',
          },
        ]}
      />
    );

    expect(screen.getByText('Mar 28, 2026')).toBeInTheDocument();
  });

  it('keeps invalid date strings visible and machine-readable instead of throwing', () => {
    render(
      <OgabasseyV2Blog
        posts={[
          {
            ...mockPosts[0],
            id: 'invalid-date-post',
            published_at: 'not-a-date',
          },
        ]}
      />
    );

    const dateLabel = screen.getByText('not-a-date');

    expect(dateLabel.tagName.toLowerCase()).toBe('time');
    expect(dateLabel).toHaveAttribute('datetime', 'not-a-date');
  });
});
