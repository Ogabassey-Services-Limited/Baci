import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/seo/json-ld', () => ({
  JsonLd: () => <script type="application/ld+json" />,
}));
vi.mock('./ogabassey-home-style-loader', () => ({
  OgabasseyHomeStyleLoader: () => <style data-testid="style-loader" />,
}));
vi.mock('./ogabassey-home-hero-fallback', () => ({
  OgabasseyHomeHeroFallback: () => (
    <section data-testid="hero-fallback">Hero fallback</section>
  ),
}));
vi.mock('./ogabassey-home-page-content', () => ({
  OgabasseyHomePageContent: () => {
    throw new Promise(() => undefined);
  },
}));

import { OgabasseyStaticHomePageContent } from './ogabassey-static-home-page-content';

describe('OgabasseyStaticHomePageContent', () => {
  it('uses a non-null hero fallback for the streaming home boundary', () => {
    const { container } = render(<OgabasseyStaticHomePageContent />);

    expect(
      container.querySelector('[data-testid="hero-fallback"]')
    ).toBeInTheDocument();
  });
});
