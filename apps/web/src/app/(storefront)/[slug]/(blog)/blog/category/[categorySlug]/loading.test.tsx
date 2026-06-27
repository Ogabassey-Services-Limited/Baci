import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BlogCategoryLoading from './loading';

describe('BlogCategoryLoading', () => {
  it('shows the blog loading status for the category segment boundary', () => {
    render(<BlogCategoryLoading />);

    const status = screen.getByRole('status', { name: /loading blog posts/i });
    expect(status).toHaveAttribute('aria-live', 'polite');
  });
});
