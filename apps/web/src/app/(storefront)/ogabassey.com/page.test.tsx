import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { mockStaticHomePageContent } = vi.hoisted(() => ({
  mockStaticHomePageContent: vi.fn(
    ({ heroBasePath }: { heroBasePath: string }) => (
      <section aria-label="OgaBassey domain page">
        {heroBasePath || 'root'}
      </section>
    )
  ),
}));

vi.mock('@/app/(storefront)/ogabassey/page', () => ({
  metadata: {
    title: 'OgaBassey - Official Online Store | Baci',
  },
}));

vi.mock(
  '@/app/(storefront)/ogabassey/ogabassey-static-home-page-content',
  () => ({
    OgabasseyStaticHomePageContent: mockStaticHomePageContent,
  })
);

import OgabasseyDomainPage, { metadata } from './page';

describe('OgabasseyDomainPage', () => {
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
