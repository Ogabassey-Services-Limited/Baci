import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/seo/json-ld', () => ({
  JsonLd: () => <script type="application/ld+json" />,
}));
vi.mock('./ogabassey-home-style-loader', () => ({
  OgabasseyHomeStyleLoader: () => <style data-testid="style-loader" />,
}));
vi.mock('./ogabassey-home-page-content', () => ({
  OgabasseyHomePageContent: ({ pathPrefix }: { pathPrefix: string }) => (
    <section aria-label="Dynamic home content" data-prefix={pathPrefix} />
  ),
}));

import { OgabasseyStaticHomePageContent } from './ogabassey-static-home-page-content';

describe('OgabasseyStaticHomePageContent', () => {
  it('streams dynamic home content with the static route prefix', () => {
    render(<OgabasseyStaticHomePageContent pathPrefix="/ogabassey" />);

    expect(
      screen.getByRole('region', { name: /dynamic home content/i })
    ).toHaveAttribute('data-prefix', '/ogabassey');
    expect(
      screen.queryByRole('region', { name: /product hero/i })
    ).not.toBeInTheDocument();
  });

  it('passes the apex-domain root prefix through to the dynamic home content', () => {
    render(<OgabasseyStaticHomePageContent pathPrefix="" />);

    expect(
      screen.getByRole('region', { name: /dynamic home content/i })
    ).toHaveAttribute('data-prefix', '');
  });
});
