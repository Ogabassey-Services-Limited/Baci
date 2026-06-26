import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The OgaBassey footer links to OgaBassey's own store listings
// (OGABASSEY_STOREFRONT_APP_STORE_URL / OGABASSEY_STOREFRONT_PLAY_STORE_URL),
// NOT the global MOBILE_APPS.storefront fallbacks (which are empty so other
// merchants don't inherit the CTAs). Getters let each test drive the URLs.
const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.ogabassey.store';
const PUBLIC_BADGE_ASSETS = [
  {
    alt: 'Download on the App Store',
    path: 'badges/app-store-black.svg',
  },
  {
    alt: 'Get it on Google Play',
    path: 'badges/google-play.svg',
  },
] as const;
const mockPlatform = vi.hoisted(() => ({
  appStoreUrl: 'https://apps.apple.com/app/id6472735367',
  playStoreUrl:
    'https://play.google.com/store/apps/details?id=com.ogabassey.store',
}));

vi.mock('@/config/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/platform')>();
  return {
    ...actual,
    get OGABASSEY_STOREFRONT_APP_STORE_URL() {
      return mockPlatform.appStoreUrl;
    },
    get OGABASSEY_STOREFRONT_PLAY_STORE_URL() {
      return mockPlatform.playStoreUrl;
    },
  };
});

vi.mock('next/image', () => ({
  default: ({
    alt,
    height,
    src,
    width,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    height: number;
    src: string;
    width: number;
  }) => (
    <img
      alt={alt}
      data-height={height}
      data-width={width}
      src={src}
      {...props}
    />
  ),
}));

import { FooterAppPayments } from './FooterAppPayments';

describe('FooterAppPayments', () => {
  beforeEach(() => {
    mockPlatform.appStoreUrl = 'https://apps.apple.com/app/id6472735367';
    mockPlatform.playStoreUrl = PLAY_STORE_URL;
  });

  it('links the store badges to OgaBassey-scoped listings, not the global fallback', () => {
    render(<FooterAppPayments />);

    expect(
      screen.getByRole('link', { name: 'Download on the App Store' })
    ).toHaveAttribute('href', 'https://apps.apple.com/app/id6472735367');
    expect(
      screen.getByRole('link', { name: 'Get it on Google Play' })
    ).toHaveAttribute('href', PLAY_STORE_URL);
  });

  it('renders optimized store badges with explicit intrinsic dimensions', () => {
    render(<FooterAppPayments />);

    const appStoreBadge = screen.getByRole('img', {
      name: 'Download on the App Store',
    });
    const googlePlayBadge = screen.getByRole('img', {
      name: 'Get it on Google Play',
    });

    expect(appStoreBadge).toHaveAttribute('data-width', '120');
    expect(appStoreBadge).toHaveAttribute('data-height', '40');
    expect(googlePlayBadge).toHaveAttribute('data-width', '135');
    expect(googlePlayBadge).toHaveAttribute('data-height', '40');
  });

  it('ships the public SVG badge files referenced by the footer', () => {
    for (const asset of PUBLIC_BADGE_ASSETS) {
      const badgeSource = readFileSync(
        resolve(process.cwd(), 'public', asset.path),
        'utf8'
      );

      expect(badgeSource, `${asset.alt} should be an SVG`).toMatch(/<svg\b/);
      expect(badgeSource, `${asset.alt} should not fall back to HTML`).not.toMatch(
        /<!doctype html/i
      );
    }
  });

  it('keeps Google Play available when the App Store URL is absent', () => {
    mockPlatform.appStoreUrl = '';

    render(<FooterAppPayments />);

    expect(
      screen.queryByRole('link', { name: 'Download on the App Store' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Get it on Google Play' })
    ).toBeInTheDocument();
  });
});
