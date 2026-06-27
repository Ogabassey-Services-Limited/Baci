import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BlogVideoPanel } from './BlogVideoPanel';

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // biome-ignore lint/performance/noImgElement: test mock for next/image
    <img alt={alt} src={src} />
  ),
}));

const video = {
  thumbnailUrl: 'https://i.ytimg.com/vi/tp-AlU5FVpE/hqdefault.jpg',
  title: 'Pixel 9 Pro Fold Unboxing',
  watchUrl: 'https://www.youtube.com/watch?v=tp-AlU5FVpE',
};

describe('BlogVideoPanel', () => {
  it('renders a thumbnail-first video preview and external fallback link', () => {
    render(<BlogVideoPanel video={video} />);

    expect(
      screen.getByRole('heading', { name: /watch the related video/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: 'Video thumbnail for Pixel 9 Pro Fold Unboxing',
      })
    ).toHaveAttribute(
      'src',
      'https://i.ytimg.com/vi/tp-AlU5FVpE/hqdefault.jpg'
    );
    expect(
      screen.getByRole('link', {
        name: /open video on youtube: pixel 9 pro fold/i,
      })
    ).toHaveAttribute('href', 'https://www.youtube.com/watch?v=tp-AlU5FVpE');
    expect(
      screen.queryByTitle('Pixel 9 Pro Fold Unboxing')
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /open on youtube/i })
    ).toHaveAttribute('href', 'https://www.youtube.com/watch?v=tp-AlU5FVpE');
  });

  it('does not render an iframe that requires storefront CSP changes', () => {
    render(<BlogVideoPanel video={video} />);

    expect(screen.queryByTitle('Pixel 9 Pro Fold Unboxing')).toBeNull();
  });
});
