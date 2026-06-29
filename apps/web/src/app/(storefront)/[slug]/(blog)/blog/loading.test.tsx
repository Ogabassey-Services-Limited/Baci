import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BlogLoading from './loading';

describe('blog segment loading shell', () => {
  it('renders the blog listing fallback for route-level loading states', () => {
    render(<BlogLoading />);

    expect(
      screen.getByRole('status', { name: 'Loading blog posts' })
    ).toBeInTheDocument();
  });
});
