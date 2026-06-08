import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { mockStaticHomePageContent, mockFullStorefrontCssImport } = vi.hoisted(
  () => ({
    mockStaticHomePageContent: vi.fn(
      ({ heroBasePath }: { heroBasePath: string }) => (
        <section aria-label="OgaBassey domain page">
          {heroBasePath || 'root'}
        </section>
      )
    ),
    mockFullStorefrontCssImport: vi.fn(),
  })
);

vi.mock('@/app/(storefront)/storefront-full.css', () => {
  mockFullStorefrontCssImport();
  return {};
});

vi.mock('@/app/(storefront)/ogabassey/page', () => ({
  OgabasseyStaticHomePageContent: mockStaticHomePageContent,
  metadata: {
    title: 'OgaBassey - Official Online Store | Baci',
  },
}));

import OgabasseyDomainPage, { metadata } from './page';

describe('OgabasseyDomainPage', () => {
  it('loads the full storefront stylesheet at the custom-domain page leaf', () => {
    expect(mockFullStorefrontCssImport).toHaveBeenCalledOnce();
  });

  it('renders the static OgaBassey homepage with the custom-domain base path', () => {
    render(<OgabasseyDomainPage />);

    expect(
      screen.getByRole('region', { name: 'OgaBassey domain page' })
    ).toHaveTextContent('root');
    expect(mockStaticHomePageContent).toHaveBeenCalledWith(
      { heroBasePath: '' },
      undefined
    );
    expect(metadata).toEqual({
      title: 'OgaBassey - Official Online Store | Baci',
    });
  });
});
