import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BlogAuthorLoading from './loading';

describe('BlogAuthorLoading', () => {
  it('shows the blog loading status for the author segment boundary', () => {
    render(<BlogAuthorLoading />);

    const status = screen.getByRole('status', { name: /loading blog posts/i });
    expect(status).toHaveAttribute('aria-live', 'polite');
  });
});
