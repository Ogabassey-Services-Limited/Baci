import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BlogTextRenderer } from './blog-text-renderer';

function textNode(marks: Array<{ type: string; attrs?: object }>) {
  return { type: 'text', text: 'Read this', marks };
}

describe('BlogTextRenderer', () => {
  it('renders plain text without marks', () => {
    render(<BlogTextRenderer node={{ type: 'text', text: 'Plain' }} />);

    expect(screen.getByText('Plain')).toBeInTheDocument();
  });

  it('renders nothing for empty text nodes', () => {
    const { container } = render(
      <BlogTextRenderer node={{ type: 'text', text: '' }} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders bold marks as strong elements', () => {
    render(<BlogTextRenderer node={textNode([{ type: 'bold' }])} />);

    expect(screen.getByText('Read this').tagName).toBe('STRONG');
  });

  it('renders internal links with normalized hrefs', () => {
    render(
      <BlogTextRenderer
        node={textNode([
          { type: 'link', attrs: { href: '/phones/iphone-15' } },
        ])}
        merchantSlug="ogabassey"
      />
    );

    expect(screen.getByRole('link', { name: 'Read this' })).toHaveAttribute(
      'href',
      '/smartphones/iphone-15'
    );
  });

  it('unwraps links whose target is in the dead sets', () => {
    render(
      <BlogTextRenderer
        node={textNode([{ type: 'link', attrs: { href: '/blog/dead-post' } }])}
        deadContentLinkSets={{
          blog: new Set(['dead-post']),
          products: new Set(),
        }}
      />
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Read this')).toBeInTheDocument();
  });

  it('rewrites redirectable links to their canonical path', () => {
    render(
      <BlogTextRenderer
        node={textNode([
          { type: 'link', attrs: { href: '/blog/renamed-post' } },
        ])}
        contentLinkRewrites={{
          blogSlugs: { 'renamed-post': 'new-post' },
          productPaths: {},
        }}
      />
    );

    expect(screen.getByRole('link', { name: 'Read this' })).toHaveAttribute(
      'href',
      '/blog/new-post'
    );
  });

  it('renders technical resource hrefs as plain text', () => {
    render(
      <BlogTextRenderer
        node={textNode([{ type: 'link', attrs: { href: '/some-chunk.js' } }])}
      />
    );

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
