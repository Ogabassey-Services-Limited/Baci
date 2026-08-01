import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

import { BlogClientHeader } from './blog-client-header';

describe('BlogClientHeader', () => {
  it('renders safe RSS and AI controls for eligible merchants', () => {
    render(
      <BlogClientHeader
        autoBlogEnabled
        merchant={{ id: 'merchant-1', slug: 'demo-store' }}
      />
    );

    expect(screen.getByRole('link', { name: /rss feed/i })).toHaveAttribute(
      'href',
      '/api/blog/feed/demo-store'
    );
    expect(screen.getByRole('link', { name: /ai generator/i })).toHaveAttribute(
      'href',
      '/dashboard/blog/ai-generator'
    );
  });

  it('omits RSS when the merchant has no slug', () => {
    render(
      <BlogClientHeader
        autoBlogEnabled={false}
        merchant={{ id: 'merchant-1' }}
      />
    );

    expect(screen.queryByRole('link', { name: /rss feed/i })).toBeNull();
    expect(screen.getByRole('link', { name: /new post/i })).toBeInTheDocument();
  });
});
