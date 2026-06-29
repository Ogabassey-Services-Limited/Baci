import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCriticalHomeCssImport,
  mockFullStorefrontCssImport,
  mockOgabasseyStaticHomePageContent,
  mockOgabasseyStaticResourceHints,
  mockStorefrontPageContent,
} = vi.hoisted(() => ({
  mockCriticalHomeCssImport: vi.fn(),
  mockFullStorefrontCssImport: vi.fn(),
  mockOgabasseyStaticHomePageContent: vi.fn(
    ({ pathPrefix }: { pathPrefix: string }) => (
      <main>OgaBassey static home {pathPrefix || 'root'}</main>
    )
  ),
  mockOgabasseyStaticResourceHints: vi.fn(() => (
    <span data-testid="ogabassey-static-resource-hints" />
  )),
  mockStorefrontPageContent: vi.fn(() => (
    <main>Shared storefront page content</main>
  )),
}));

vi.mock('@/app/(storefront)/storefront-home-critical.css', () => {
  mockCriticalHomeCssImport();
  return {};
});

vi.mock('@/app/(storefront)/storefront-full.css', () => {
  mockFullStorefrontCssImport();
  return {};
});

vi.mock(
  '@/app/(storefront)/ogabassey/ogabassey-static-home-page-content',
  () => ({
    OgabasseyStaticHomePageContent: ({ pathPrefix }: { pathPrefix: string }) =>
      mockOgabasseyStaticHomePageContent({ pathPrefix }),
  })
);

vi.mock('@/app/(storefront)/ogabassey/ogabassey-static-resource-hints', () => ({
  OgabasseyStaticResourceHints: () => mockOgabasseyStaticResourceHints(),
}));

vi.mock('../storefront-page-content', () => ({
  StorefrontPageContent: () => mockStorefrontPageContent(),
}));

const { default: StorefrontPage } = await import('./page');

describe('OgaBassey dynamic homepage routing', () => {
  beforeEach(() => {
    mockOgabasseyStaticHomePageContent.mockClear();
    mockOgabasseyStaticResourceHints.mockClear();
    mockStorefrontPageContent.mockClear();
  });

  it('loads the home CSS contracts from the dynamic route leaf', () => {
    expect(mockCriticalHomeCssImport).toHaveBeenCalledOnce();
    expect(mockFullStorefrontCssImport).toHaveBeenCalledOnce();
  });

  it('renders other storefronts through the shared page content path', async () => {
    render(
      await StorefrontPage({
        params: Promise.resolve({ slug: 'another-shop' }),
      })
    );

    expect(
      screen.getByText('Shared storefront page content')
    ).toBeInTheDocument();
  });

  it('renders the path homepage with the OgaBassey static shell', async () => {
    render(
      await StorefrontPage({
        params: Promise.resolve({ slug: 'ogabassey' }),
      })
    );

    expect(mockOgabasseyStaticResourceHints).toHaveBeenCalledOnce();
    expect(mockOgabasseyStaticHomePageContent).toHaveBeenCalledWith({
      pathPrefix: '/ogabassey',
    });
    expect(
      screen.getByText('OgaBassey static home /ogabassey')
    ).toBeInTheDocument();
    expect(mockStorefrontPageContent).not.toHaveBeenCalled();
  });

  it('renders the custom-domain local homepage with root-relative links', async () => {
    render(
      await StorefrontPage({
        params: Promise.resolve({ slug: 'ogabassey.com' }),
      })
    );

    expect(mockOgabasseyStaticHomePageContent).toHaveBeenCalledWith({
      pathPrefix: '',
    });
    expect(screen.getByText('OgaBassey static home root')).toBeInTheDocument();
  });
});
