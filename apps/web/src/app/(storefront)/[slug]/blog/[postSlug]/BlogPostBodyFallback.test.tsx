import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlogPostBodyFallback } from './BlogPostBodyFallback';

describe('BlogPostBodyFallback', () => {
  it('renders the skeleton fallback shell', () => {
    render(<BlogPostBodyFallback />);
    const fallback = screen.getByTestId('blog-post-body-fallback');

    expect(fallback).toHaveAttribute('aria-hidden', 'true');
    expect(fallback.children).toHaveLength(5);
  });
});
