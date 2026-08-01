import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useMerchantFeatures = vi.hoisted(() => vi.fn());

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock('@/hooks/use-merchant-features', () => ({ useMerchantFeatures }));
vi.mock('./blog-client-content', () => ({
  BlogClientContent: () => <div>Blog content</div>,
}));

import { ActiveBlogClientPage } from './active-blog-client-page';

const merchant = { id: 'merchant-b', slug: 'merchant-b' };

describe('ActiveBlogClientPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a loading status while the active merchant feature is loading', () => {
    useMerchantFeatures.mockReturnValue({
      blogEnabled: false,
      isLoading: true,
    });

    render(
      <ActiveBlogClientPage activeMerchant={merchant} merchant={merchant} />
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading blog feature'
    );
    expect(screen.queryByText('Blog Feature')).not.toBeInTheDocument();
  });

  it('shows the feature card while the active merchant has blogging disabled', () => {
    useMerchantFeatures.mockReturnValue({
      blogEnabled: false,
      isLoading: false,
    });

    render(
      <ActiveBlogClientPage activeMerchant={merchant} merchant={merchant} />
    );

    expect(screen.getByText('Blog Feature')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Enable Blog Feature' })
    ).toHaveAttribute('href', '/dashboard/settings');
    expect(screen.queryByText('Blog content')).not.toBeInTheDocument();
    expect(useMerchantFeatures).toHaveBeenCalledWith('merchant-b');
  });

  it('renders blog content when the active merchant has blogging enabled', () => {
    useMerchantFeatures.mockReturnValue({
      blogEnabled: true,
      isLoading: false,
    });

    render(
      <ActiveBlogClientPage activeMerchant={merchant} merchant={merchant} />
    );

    expect(screen.getByText('Blog content')).toBeInTheDocument();
    expect(screen.queryByText('Blog Feature')).not.toBeInTheDocument();
  });
});
