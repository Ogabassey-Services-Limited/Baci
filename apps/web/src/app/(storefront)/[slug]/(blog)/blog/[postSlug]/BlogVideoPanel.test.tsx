import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlogVideoPanel } from './BlogVideoPanel';

describe('BlogVideoPanel', () => {
  it('renders a lazy YouTube player and external fallback link', () => {
    render(
      <BlogVideoPanel
        video={{
          embedUrl: 'https://www.youtube-nocookie.com/embed/tp-AlU5FVpE',
          thumbnailUrl: 'https://i.ytimg.com/vi/tp-AlU5FVpE/hqdefault.jpg',
          title: 'Pixel 9 Pro Fold Unboxing',
          watchUrl: 'https://www.youtube.com/watch?v=tp-AlU5FVpE',
        }}
      />
    );

    const frame = screen.getByTitle('Pixel 9 Pro Fold Unboxing');

    expect(
      screen.getByRole('heading', { name: /watch the related video/i })
    ).toBeInTheDocument();
    expect(frame).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/tp-AlU5FVpE'
    );
    expect(frame).toHaveAttribute('loading', 'lazy');
    expect(
      screen.getByRole('link', { name: /open on youtube/i })
    ).toHaveAttribute('href', 'https://www.youtube.com/watch?v=tp-AlU5FVpE');
  });
});
