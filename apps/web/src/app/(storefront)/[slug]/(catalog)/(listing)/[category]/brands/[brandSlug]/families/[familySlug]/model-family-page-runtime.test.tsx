import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLoad = vi.fn();
const mockGetPathPrefix = vi.fn();
const mockContent = vi.fn();
vi.mock('@/lib/storefront-category/load-model-family-authority-page', () => ({
  modelFamilyAuthorityPageLoader: {
    load: (...args: unknown[]) => mockLoad(...args),
  },
}));
vi.mock('@/lib/storefront-category/load-brand-authority-page', () => ({
  brandAuthorityPageLoader: {
    getStorefrontPathPrefix: (...args: unknown[]) => mockGetPathPrefix(...args),
  },
}));
vi.mock('../../brand-authority-page-content', () => ({
  BrandAuthorityPageContent: (props: unknown) => {
    mockContent(props);
    return <div>family page</div>;
  },
}));
vi.mock('next/server', () => ({ connection: vi.fn() }));
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('not found');
  }),
}));

describe('model family page runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoad.mockResolvedValue({
      merchant: { slug: 'store' },
      heading: 'Galaxy S',
    });
    mockGetPathPrefix.mockResolvedValue('');
  });

  it('loads and renders the curated family', async () => {
    const { modelFamilyPageRuntime } = await import(
      './model-family-page-runtime'
    );
    const props = {
      params: Promise.resolve({
        slug: 'store',
        category: 'smartphones',
        brandSlug: 'samsung',
        familySlug: 'galaxy-s',
      }),
    };
    const element = await modelFamilyPageRuntime.render(props);
    element.type(element.props);
    expect(mockLoad).toHaveBeenCalledWith({
      merchantSlug: 'store',
      categorySlug: 'smartphones',
      brandSlug: 'samsung',
      familySlug: 'galaxy-s',
    });
    expect(mockContent).toHaveBeenCalledWith(
      expect.objectContaining({
        page: expect.objectContaining({ pathPrefix: '' }),
      })
    );
  });
});
