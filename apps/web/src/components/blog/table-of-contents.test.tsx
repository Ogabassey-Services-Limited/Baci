import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableOfContents } from './table-of-contents';

class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

describe('TableOfContents', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('includes h4 article subsections after blog heading levels are shifted', async () => {
    document.body.innerHTML = `
      <article class="blog-content-renderer">
        <h2 id="overview">Overview</h2>
        <h3 id="camera">Camera</h3>
        <h4 id="camera-details">Camera Details</h4>
      </article>
    `;

    render(<TableOfContents />);

    expect(
      await screen.findByRole('link', { name: 'Camera Details' })
    ).toHaveAttribute('href', '#camera-details');
  });

  it('indents collected h3 and h4 headings by their rendered depth', async () => {
    document.body.innerHTML = `
      <article class="blog-content-renderer">
        <h2 id="overview">Overview</h2>
        <h3 id="camera">Camera</h3>
        <h4 id="camera-details">Camera Details</h4>
      </article>
    `;

    render(<TableOfContents />);

    expect(await screen.findByRole('link', { name: 'Camera' })).toHaveClass(
      'pl-4'
    );
    expect(screen.getByRole('link', { name: 'Camera Details' })).toHaveClass(
      'pl-8'
    );
  });

  it('does not render without a blog content container', () => {
    render(<TableOfContents />);

    expect(
      screen.queryByRole('navigation', { name: 'Table of contents' })
    ).not.toBeInTheDocument();
  });

  it('does not render when fewer than three headings are collected', () => {
    document.body.innerHTML = `
      <article class="blog-content-renderer">
        <h2 id="overview">Overview</h2>
        <h3 id="camera">Camera</h3>
      </article>
    `;

    render(<TableOfContents />);

    expect(
      screen.queryByRole('navigation', { name: 'Table of contents' })
    ).not.toBeInTheDocument();
  });
});
