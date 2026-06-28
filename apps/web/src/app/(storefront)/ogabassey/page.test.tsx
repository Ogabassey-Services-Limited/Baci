import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  OGABASSEY_APPLE_TOUCH_ICON_URL,
  OGABASSEY_DESCRIPTION,
  OGABASSEY_FAVICON_URL,
  OGABASSEY_MERCHANT_ID,
  OGABASSEY_SOCIAL_IMAGE_URL,
  OGABASSEY_TITLE,
  OGABASSEY_TWITTER_HANDLE,
  OGABASSEY_URL,
} from '@/config/ogabassey';

const mockHomeStorefrontCssImport = vi.hoisted(() => vi.fn());

vi.mock('@/app/(storefront)/storefront-home.css', () => {
  mockHomeStorefrontCssImport();
  return {};
});

const mockOgabasseyHomePageContent = vi.hoisted(() =>
  vi.fn(() => <main>OgaBassey storefront</main>)
);
const mockHomeStyleLoader = vi.hoisted(() => vi.fn());
vi.mock('server-only', () => ({}));

vi.mock('./ogabassey-home-page-content', () => ({
  OgabasseyHomePageContent: () => mockOgabasseyHomePageContent(),
}));

vi.mock('./ogabassey-home-style-loader', () => ({
  OgabasseyHomeStyleLoader: () => {
    mockHomeStyleLoader();
    return <span>Deferred homepage styles</span>;
  },
}));

import * as pageModule from './page';
import OgabasseyStaticHomePage, { metadata } from './page';

describe('OgabasseyStaticHomePage', () => {
  it('keeps the complete homepage stylesheet out of the static server shell', () => {
    expect(mockHomeStorefrontCssImport).not.toHaveBeenCalled();
  });
  it('renders the OgaBassey-specific home route shell', () => {
    render(<OgabasseyStaticHomePage />);

    expect(screen.getByText('Deferred homepage styles')).toBeInTheDocument();
    expect(mockHomeStyleLoader).toHaveBeenCalledOnce();
    // The hero is now product-driven and renders inside the dynamic home
    // content, not in this static shell.
    expect(screen.getByRole('main')).toHaveTextContent('OgaBassey storefront');
    expect(mockOgabasseyHomePageContent).toHaveBeenCalled();
  });

  it('keeps the shared home shell out of the Next app-router page exports', () => {
    expect(pageModule).not.toHaveProperty('OgabasseyStaticHomePageContent');
  });

  it('emits static WebPage JSON-LD for the public homepage shell', () => {
    const { container } = render(<OgabasseyStaticHomePage />);

    const schemaScript = container.querySelector(
      'script[type="application/ld+json"]'
    );

    expect(schemaScript).not.toBeNull();
    expect(JSON.parse(schemaScript?.textContent || '{}')).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      description: OGABASSEY_DESCRIPTION,
      name: OGABASSEY_TITLE,
      url: OGABASSEY_URL,
    });
  });

  it('declares canonical, hreflang, favicon, and social image metadata for the static route', () => {
    expect(metadata.alternates).toEqual(
      expect.objectContaining({
        canonical: OGABASSEY_URL,
        languages: {
          'en-NG': OGABASSEY_URL,
          'x-default': OGABASSEY_URL,
        },
      })
    );
    expect(metadata.openGraph).toEqual(
      expect.objectContaining({
        images: [
          {
            alt: 'OgaBassey storefront preview',
            height: 900,
            url: OGABASSEY_SOCIAL_IMAGE_URL,
            width: 1440,
          },
        ],
      })
    );
    expect(metadata.twitter).toEqual(
      expect.objectContaining({
        images: [OGABASSEY_SOCIAL_IMAGE_URL],
        site: OGABASSEY_TWITTER_HANDLE,
      })
    );
    expect(metadata.icons).toEqual({
      apple: OGABASSEY_APPLE_TOUCH_ICON_URL,
      icon: OGABASSEY_FAVICON_URL,
      shortcut: OGABASSEY_FAVICON_URL,
    });
  });

  it('uses the existing merchant media favicon paths for static route icons', () => {
    expect(OGABASSEY_FAVICON_URL).toBe(
      `https://cdn.ogabassey.com/media/merchants/${OGABASSEY_MERCHANT_ID}/favicon/favicon-32.png`
    );
    expect(OGABASSEY_APPLE_TOUCH_ICON_URL).toBe(
      `https://cdn.ogabassey.com/media/merchants/${OGABASSEY_MERCHANT_ID}/favicon/apple-touch-icon.png`
    );
    expect(OGABASSEY_FAVICON_URL).not.toContain('.supabase.co/');
    expect(OGABASSEY_APPLE_TOUCH_ICON_URL).not.toContain('.supabase.co/');
    expect(OGABASSEY_FAVICON_URL).not.toContain('/object/public/favicons/');
    expect(OGABASSEY_APPLE_TOUCH_ICON_URL).not.toContain(
      '/object/public/favicons/'
    );
  });
});
