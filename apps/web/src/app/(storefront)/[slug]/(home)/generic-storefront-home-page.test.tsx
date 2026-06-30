import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { mockFullStorefrontCssImport, mockStorefrontPageContent } = vi.hoisted(
  () => ({
    mockFullStorefrontCssImport: vi.fn(),
    mockStorefrontPageContent: vi.fn(
      (_props: { params: Promise<{ slug: string }> }) => (
        <main>Shared storefront page content</main>
      )
    ),
  })
);

vi.mock('@/app/(storefront)/storefront-full.css', () => {
  mockFullStorefrontCssImport();
  return {};
});

vi.mock('../storefront-page-content', () => ({
  StorefrontPageContent: (props: { params: Promise<{ slug: string }> }) =>
    mockStorefrontPageContent(props),
}));

const { GenericStorefrontHomePage } = await import(
  './generic-storefront-home-page'
);

describe('GenericStorefrontHomePage', () => {
  it('keeps the broad storefront stylesheet scoped to the generic home renderer', () => {
    expect(mockFullStorefrontCssImport).toHaveBeenCalledOnce();
  });

  it('forwards the tracked route params promise to the shared page content', () => {
    const params = Promise.resolve({ slug: 'another-shop' });

    render(<GenericStorefrontHomePage params={params} />);

    expect(
      screen.getByText('Shared storefront page content')
    ).toBeInTheDocument();
    expect(mockStorefrontPageContent).toHaveBeenCalledWith({ params });
  });
});
