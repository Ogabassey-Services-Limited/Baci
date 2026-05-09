import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  OGABASSEY_APPLE_TOUCH_ICON_URL,
  OGABASSEY_FAVICON_URL,
  OGABASSEY_MERCHANT_ID,
  OGABASSEY_SOCIAL_IMAGE_URL,
  OGABASSEY_TWITTER_HANDLE,
  OGABASSEY_URL,
} from '@/config/ogabassey';

const mockOgabasseyHomePageContent = vi.hoisted(() =>
  vi.fn(({ renderHero }: { renderHero?: boolean }) => (
    <main>OgaBassey storefront: {String(renderHero)}</main>
  ))
);

vi.mock(
  '@/components/storefront/ogabassey/components/ogabassey-hero-preloads',
  () => ({
    OgabasseyHeroPreloads: () => <div data-testid="hero-preloads" />,
  })
);

vi.mock('./ogabassey-home-page-content', () => ({
  OgabasseyHomePageContent: (props: { renderHero?: boolean }) =>
    mockOgabasseyHomePageContent(props),
}));

import OgabasseyStaticHomePage, { metadata } from './page';

describe('OgabasseyStaticHomePage', () => {
  it('renders the OgaBassey-specific home route shell', () => {
    render(<OgabasseyStaticHomePage />);

    expect(screen.getByTestId('hero-preloads')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent(
      'OgaBassey storefront: undefined'
    );
    expect(mockOgabasseyHomePageContent).toHaveBeenCalledWith({});
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

  it('uses the active favicon upload bucket paths for static route icons', () => {
    expect(OGABASSEY_FAVICON_URL).toContain(
      `/storage/v1/object/public/favicons/${OGABASSEY_MERCHANT_ID}/icon-32.png`
    );
    expect(OGABASSEY_APPLE_TOUCH_ICON_URL).toContain(
      `/storage/v1/object/public/favicons/${OGABASSEY_MERCHANT_ID}/apple-touch-icon.png`
    );
    expect(OGABASSEY_FAVICON_URL).not.toContain('/media/merchants/');
    expect(OGABASSEY_APPLE_TOUCH_ICON_URL).not.toContain('/media/merchants/');
  });
});
