import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlogListingFallback } from '@/app/(storefront)/[slug]/(blog)/blog/BlogListingFallback';
import BlogLoading from '@/app/(storefront)/[slug]/(blog)/blog/loading';

describe('BlogLoading', () => {
  it('uses the blog listing fallback for the route segment', () => {
    const { container } = render(<BlogLoading />);
    const { container: fallbackContainer } = render(<BlogListingFallback />);

    expect(container.innerHTML).toBe(fallbackContainer.innerHTML);
  });
});
