import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HERO_MOBILE_UTILITY_PANEL_MIN_HEIGHT_CLASS } from '@/components/storefront/ogabassey/components/hero-mobile-geometry';

vi.mock('@/components/seo/json-ld', () => ({
  JsonLd: () => <script type="application/ld+json" />,
}));
vi.mock('./ogabassey-home-style-loader', () => ({
  OgabasseyHomeStyleLoader: () => <style data-testid="style-loader" />,
}));
const mockDynamicContentSuspends = vi.hoisted(() => ({ value: false }));
vi.mock('./ogabassey-home-page-content', () => ({
  OgabasseyHomePageContent: ({
    pathPrefix,
    shellMerchantId,
    shellSlides,
  }: {
    pathPrefix: string;
    shellMerchantId: string | null;
    shellSlides: unknown[] | null;
  }) => {
    if (mockDynamicContentSuspends.value) {
      // Suspend forever so the Suspense fallback actually renders.
      throw new Promise(() => undefined);
    }
    return (
      <section
        aria-label="Dynamic home content"
        data-prefix={pathPrefix}
        data-shell-merchant-id={shellMerchantId ?? 'none'}
        data-shell-slide-count={shellSlides?.length ?? 'none'}
      />
    );
  },
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

const mockCriticalHero = vi.hoisted(() => vi.fn());
vi.mock('@/components/storefront/ogabassey/components/Hero', () => ({
  Hero: (props: { slides: unknown[] }) => {
    mockCriticalHero(props);
    return (
      <section
        aria-label="Permanent critical hero"
        data-slide-count={props.slides.length}
      />
    );
  },
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
    mockDynamicContentSuspends.value = false;
    mockResolveHeroShell.mockResolvedValue({
      status: 'published',
      merchantId: 'merchant-1',
      slides: [SHELL_SLIDE],
    });
  });

  it('passes cached slides into the request-scoped publication owner', async () => {
    render(await OgabasseyStaticHomePageContent({ pathPrefix: '/ogabassey' }));

    expect(
      screen.queryByRole('region', { name: /permanent critical hero/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: /dynamic home content/i })
    ).toHaveAttribute('data-shell-slide-count', '1');
    expect(
      screen.getByRole('region', { name: /dynamic home content/i })
    ).toHaveAttribute('data-shell-merchant-id', 'merchant-1');
    expect(mockCriticalHero).not.toHaveBeenCalled();
    expect(mockResolveHeroShell).toHaveBeenCalledWith();
  });

  it('passes an empty published feed through the publication owner', async () => {
    mockResolveHeroShell.mockResolvedValue({
      status: 'published',
      merchantId: 'merchant-1',
      slides: [],
    });

    render(await OgabasseyStaticHomePageContent({ pathPrefix: '' }));

    expect(
      screen.queryByRole('region', { name: /permanent critical hero/i })
    ).not.toBeInTheDocument();
    expect(mockCriticalHero).not.toHaveBeenCalled();
    expect(
      screen.getByRole('region', { name: /dynamic home content/i })
    ).toHaveAttribute('data-shell-slide-count', '0');
    expect(mockPreloadHeroResources).not.toHaveBeenCalled();
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

  it('shows only publication-safe geometry while the publication owner suspends', async () => {
    mockDynamicContentSuspends.value = true;

    render(await OgabasseyStaticHomePageContent({ pathPrefix: '' }));

    expect(
      screen.queryByRole('region', { name: /permanent critical hero/i })
    ).not.toBeInTheDocument();
    expect(
      document.querySelector(
        '[data-ogabassey-publication-safe-hero-fallback="true"]'
      )
    ).toBeInTheDocument();
    expect(document.querySelector('a, button, img')).not.toBeInTheDocument();
    expect(
      document.querySelector(
        '[data-ogabassey-publication-safe-utility-fallback="true"]'
      )
    ).toHaveClass(HERO_MOBILE_UTILITY_PANEL_MIN_HEIGHT_CLASS);
    expect(
      screen.queryByRole('region', { name: /dynamic home content/i })
    ).not.toBeInTheDocument();
  });

  it('fails closed without shopping UI when the shell lookup fails open', async () => {
    mockResolveHeroShell.mockResolvedValue(null);

    render(await OgabasseyStaticHomePageContent({ pathPrefix: '' }));

    expect(
      screen.queryByRole('region', { name: /permanent critical hero/i })
    ).not.toBeInTheDocument();
    expect(mockCriticalHero).not.toHaveBeenCalled();
  });

  it('omits shopping UI when the cached merchant is unpublished', async () => {
    mockResolveHeroShell.mockResolvedValue({ status: 'unpublished' });

    render(await OgabasseyStaticHomePageContent({ pathPrefix: '' }));

    expect(
      screen.queryByRole('region', { name: /permanent critical hero/i })
    ).not.toBeInTheDocument();
    expect(mockCriticalHero).not.toHaveBeenCalled();
  });

  it('skips the preload and keeps rendering when the shell lookup fails open', async () => {
    mockResolveHeroShell.mockResolvedValue(null);

    render(await OgabasseyStaticHomePageContent({ pathPrefix: '' }));

    expect(mockPreloadHeroResources).not.toHaveBeenCalled();
    expect(
      screen.getByRole('region', { name: /dynamic home content/i })
    ).toHaveAttribute('data-shell-slide-count', 'none');
  });
});
