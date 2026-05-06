import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockMerchant } = vi.hoisted(() => ({
  mockMerchant: {
    business_name: 'OgaBassey',
    country: 'NG',
    custom_domain: 'ogabassey.com',
    favicon_apple_touch_url:
      'https://cdn.example.com/ogabassey/apple-touch-icon.png',
    favicon_png_32_url: 'https://cdn.example.com/ogabassey/favicon-32.png',
    favicon_svg_url: 'https://cdn.example.com/ogabassey/favicon.svg',
    logo_url: 'https://cdn.example.com/ogabassey/logo.svg',
    site_description:
      'Shop OgaBassey for phones, laptops, gaming consoles, accessories, airtime, data, and flexible payment options in Nigeria.',
    site_tagline: '',
    site_title: 'OgaBassey - Official Online Store',
    slug: 'ogabassey',
    social_media: { twitter: '@ogabasseyy' },
  },
}));

vi.mock('@/lib/cached-data', () => ({
  getRequestScopedMerchant: vi.fn(() => Promise.resolve(mockMerchant)),
}));

vi.mock('next/server', () => ({
  connection: vi.fn(() => Promise.resolve()),
}));

vi.mock(
  '@/components/storefront/ogabassey/components/ogabassey-hero-preloads',
  () => ({
    OgabasseyHeroPreloads: () => <div data-testid="hero-preloads" />,
  })
);

vi.mock('./ogabassey-home-page-content', () => ({
  OgabasseyHomePageContent: () => <main>OgaBassey storefront</main>,
}));

import OgabasseyStaticHomePage, { generateMetadata } from './page';

describe('OgabasseyStaticHomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the OgaBassey-specific home route shell', () => {
    render(<OgabasseyStaticHomePage />);

    expect(screen.getByTestId('hero-preloads')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('OgaBassey storefront');
  });

  it('declares canonical, hreflang, favicon, and social image metadata for the static route', async () => {
    const metadata = await generateMetadata();

    expect(metadata.alternates).toEqual(
      expect.objectContaining({
        canonical: 'https://ogabassey.com',
        languages: {
          'en-NG': 'https://ogabassey.com',
          'x-default': 'https://ogabassey.com',
        },
      })
    );
    expect(metadata.openGraph).toEqual(
      expect.objectContaining({
        images: [
          {
            alt: 'OgaBassey logo',
            url: 'https://cdn.example.com/ogabassey/logo.svg',
          },
        ],
      })
    );
    expect(metadata.twitter).toEqual(
      expect.objectContaining({
        images: ['https://cdn.example.com/ogabassey/logo.svg'],
        site: '@ogabasseyy',
      })
    );
    expect(metadata.icons).toEqual({
      apple: 'https://cdn.example.com/ogabassey/apple-touch-icon.png',
      icon: 'https://cdn.example.com/ogabassey/favicon.svg',
      shortcut: 'https://cdn.example.com/ogabassey/favicon-32.png',
    });
  });
});
