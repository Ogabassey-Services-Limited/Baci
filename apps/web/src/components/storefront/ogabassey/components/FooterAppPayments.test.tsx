import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The OgaBassey footer links to OgaBassey's own App Store listing
// (OGABASSEY_STOREFRONT_APP_STORE_URL), NOT the global MOBILE_APPS.storefront
// fallback (which is empty so other merchants don't inherit the CTA). A getter
// lets each test drive the App Store URL's presence.
const mockPlatform = vi.hoisted(() => ({
  appStoreUrl: 'https://apps.apple.com/app/id6472735367',
}));

vi.mock('@/config/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/platform')>();
  return {
    ...actual,
    get OGABASSEY_STOREFRONT_APP_STORE_URL() {
      return mockPlatform.appStoreUrl;
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
