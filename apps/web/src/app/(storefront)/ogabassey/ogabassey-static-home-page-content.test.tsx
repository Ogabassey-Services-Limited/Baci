import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/seo/json-ld', () => ({
  JsonLd: () => <script type="application/ld+json" />,
}));
vi.mock('./ogabassey-home-style-loader', () => ({
  OgabasseyHomeStyleLoader: () => <style data-testid="style-loader" />,
}));
vi.mock('./ogabassey-home-hero-section', () => ({
  OgabasseyHomeHeroSection: ({
    merchantId,
    pathPrefix,
  }: {
    merchantId: string;
    pathPrefix: string;
  }) => (
    <section
      aria-label="Product hero"
      data-merchant={merchantId}
      data-prefix={pathPrefix}
    >
      hero
    </section>
  ),
}));
vi.mock('./ogabassey-home-page-content', () => ({
  OgabasseyHomePageContent: () => {
    throw new Promise(() => undefined);
  },
}));

import { OGABASSEY_MERCHANT_ID } from '@/config/ogabassey';
import { OgabasseyStaticHomePageContent } from './ogabassey-static-home-page-content';

describe('OgabasseyStaticHomePageContent', () => {
  it('renders the product hero statically in the shell with the known merchant and path prefix', () => {
    // The hero is rendered directly (not behind a Suspense fallback) so it lands
    // in the PPR static shell; the dynamic content streams below it.
    render(<OgabasseyStaticHomePageContent pathPrefix="/ogabassey" />);

    const hero = screen.getByRole('region', { name: /product hero/i });
    expect(hero).toBeInTheDocument();
    expect(hero).toHaveAttribute('data-merchant', OGABASSEY_MERCHANT_ID);
    expect(hero).toHaveAttribute('data-prefix', '/ogabassey');
  });

  it('passes the apex-domain root prefix through to the hero', () => {
    render(<OgabasseyStaticHomePageContent pathPrefix="" />);

    expect(
      screen.getByRole('region', { name: /product hero/i })
    ).toHaveAttribute('data-prefix', '');
  });
});
