import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockMobileApps = vi.hoisted(() => ({
  storefront: {
    appStoreUrl: 'https://apps.apple.com/app/id6472735367',
    playStoreUrl:
      'https://play.google.com/store/apps/details?id=com.baci.storefront',
  },
}));

vi.mock('@/config/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/platform')>();
  return {
    ...actual,
    MOBILE_APPS: mockMobileApps,
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
    mockMobileApps.storefront.appStoreUrl =
      'https://apps.apple.com/app/id6472735367';
    mockMobileApps.storefront.playStoreUrl =
      'https://play.google.com/store/apps/details?id=com.baci.storefront';
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
    mockMobileApps.storefront.appStoreUrl = '';

    render(<FooterAppPayments />);

    expect(
      screen.queryByRole('link', { name: 'Download on the App Store' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Get it on Google Play' })
    ).toBeInTheDocument();
  });
});
