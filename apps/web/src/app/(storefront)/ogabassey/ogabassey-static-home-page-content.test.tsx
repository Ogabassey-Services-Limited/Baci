import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

const mockResolveHeroShell = vi.hoisted(() => vi.fn());
vi.mock('./ogabassey-home-hero-shell-data', () => ({
  resolveOgabasseyHomeHeroShell: (...args: unknown[]) =>
    mockResolveHeroShell(...args),
}));

const mockPreloadHeroResources = vi.hoisted(() => vi.fn());
vi.mock('./ogabassey-home-hero-resource-hints', () => ({
  preloadOgabasseyHomeHeroResources: (...args: unknown[]) =>
    mockPreloadHeroResources(...args),
}));

vi.mock('./ogabassey-home-hero-fallback', () => ({
  OgabasseyHomeHeroFallback: () => null,
}));

import { OgabasseyStaticHomePageContent } from './ogabassey-static-home-page-content';

const SHELL_SLIDE = {
  kind: 'product' as const,
  id: 'p1',
  name: 'Tecno Spark 40 Pro',
  priceLabel: '₦250,000',
  href: '/smartphones/tecno-spark-40-pro',
  imageUrl: 'https://cdn.ogabassey.com/core-assets/products/tecno.avif',
  imageAlt: 'Tecno Spark 40 Pro',
  ctaLabel: 'Shop now',
};

describe('OgabasseyStaticHomePageContent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveHeroShell.mockResolvedValue({ slides: [SHELL_SLIDE] });
  });

  it('streams dynamic home content with the static route prefix', async () => {
    render(await OgabasseyStaticHomePageContent({ pathPrefix: '/ogabassey' }));

    expect(
      screen.getByRole('region', { name: /dynamic home content/i })
    ).toHaveAttribute('data-prefix', '/ogabassey');
    expect(mockResolveHeroShell).toHaveBeenCalledWith('/ogabassey');
  });

  it('passes the apex-domain root prefix through to the dynamic home content', async () => {
    render(await OgabasseyStaticHomePageContent({ pathPrefix: '' }));

    expect(
      screen.getByRole('region', { name: /dynamic home content/i })
    ).toHaveAttribute('data-prefix', '');
  });

  it('preloads the slide-0 hero image when cached shell slides resolve', async () => {
    render(await OgabasseyStaticHomePageContent({ pathPrefix: '' }));

    expect(mockPreloadHeroResources).toHaveBeenCalledWith(SHELL_SLIDE.imageUrl);
  });

  it('skips the preload and keeps rendering when the shell lookup fails open', async () => {
    mockResolveHeroShell.mockResolvedValue(null);

    render(await OgabasseyStaticHomePageContent({ pathPrefix: '' }));

    expect(mockPreloadHeroResources).not.toHaveBeenCalled();
    expect(
      screen.getByRole('region', { name: /dynamic home content/i })
    ).toBeInTheDocument();
  });
});
