import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BlogLoading from '@/app/(storefront)/[slug]/(blog)/blog/loading';

describe('BlogLoading', () => {
  it('shows the blog loading status for the route segment', () => {
    render(<BlogLoading />);

    const status = screen.getByRole('status', { name: /loading blog posts/i });
    expect(status).toHaveAttribute('aria-live', 'polite');
  });
});
