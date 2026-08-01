import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  BlogClientPage,
  mockCounts,
  mockMerchant,
  mockPosts,
  setupBlogClientPageTests,
  useMerchant,
  useMerchantFeatures,
} from './blog-client-page.test-support';

vi.mock('./blog-client-content', () => ({
  BlogClientContent: () => <div>Blog content</div>,
}));

const selectedMerchant = {
  custom_domain: null,
  id: 'merchant-b',
  slug: 'merchant-b',
};

describe('BlogClientPage selected merchant feature gate', () => {
  setupBlogClientPageTests();

  it('blocks the selected merchant when B is disabled even if implicit A is enabled', () => {
    vi.mocked(useMerchant).mockReturnValue({
      merchant: selectedMerchant,
    } as unknown as ReturnType<typeof useMerchant>);
    vi.mocked(useMerchantFeatures).mockImplementation(
      (merchantId) =>
        ({
          autoBlogEnabled: false,
          blogEnabled: merchantId === 'merchant-a',
          isLoading: false,
        }) as ReturnType<typeof useMerchantFeatures>
    );

    render(
      <BlogClientPage
        initialCounts={mockCounts}
        initialPosts={mockPosts}
        merchant={mockMerchant}
      />
    );

    expect(screen.getByText('Blog Feature')).toBeInTheDocument();
    expect(screen.queryByText('First Blog Post')).not.toBeInTheDocument();
    expect(useMerchantFeatures).toHaveBeenCalledWith('merchant-b');
  });

  it('allows selected merchant B when B is enabled', () => {
    vi.mocked(useMerchant).mockReturnValue({
      merchant: selectedMerchant,
    } as unknown as ReturnType<typeof useMerchant>);
    vi.mocked(useMerchantFeatures).mockReturnValue({
      autoBlogEnabled: false,
      blogEnabled: true,
      isLoading: false,
    } as ReturnType<typeof useMerchantFeatures>);

    render(
      <BlogClientPage
        initialCounts={mockCounts}
        initialPosts={mockPosts}
        merchant={mockMerchant}
      />
    );

    expect(screen.getByText('Blog content')).toBeInTheDocument();
    expect(screen.queryByText('Blog Feature')).not.toBeInTheDocument();
    expect(useMerchantFeatures).toHaveBeenCalledWith('merchant-b');
  });
});
