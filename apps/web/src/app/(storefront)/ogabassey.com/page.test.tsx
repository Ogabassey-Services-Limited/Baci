import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { mockStaticHomePageContent } = vi.hoisted(() => ({
  mockStaticHomePageContent: vi.fn(() => (
    <section aria-label="OgaBassey domain page">OgaBassey home</section>
  )),
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
    ).toBeInTheDocument();
    expect(mockStaticHomePageContent).toHaveBeenCalled();
    expect(metadata).toEqual({
      title: 'OgaBassey - Official Online Store | Baci',
    });
  });
});
