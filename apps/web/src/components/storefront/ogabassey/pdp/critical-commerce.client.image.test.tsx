import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
  OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
} from '@/components/storefront/ogabassey/config/product-media';

// Capture the props the critical LCP image forwards to CdnFormatImage without
// running the real next/image pipeline (CdnFormatImage has its own end-to-end
// tests). Surface it as a plain <img> so onError-driven fallback still fires.
const capturedProps = vi.hoisted(() => ({ current: [] as Record<string, unknown>[] }));

vi.mock('@/components/storefront/cdn-format-image', () => ({
  CdnFormatImage: (props: Record<string, unknown>) => {
    capturedProps.current.push(props);
    return (
      <img
        alt={String(props.alt ?? '')}
        data-ogabassey-pdp-image={props['data-ogabassey-pdp-image']}
        onError={props.onError as never}
        src={String(props.src ?? '')}
      />
    );
  },
}));

import { OgabasseyPdpCriticalProductImage } from './critical-commerce.client';

const CDN_IMAGE =
  'https://cdn.ogabassey.com/core-assets/products/pixel-9-pro.avif';

describe('OgabasseyPdpCriticalProductImage', () => {
  beforeEach(() => {
    capturedProps.current = [];
  });

  it('renders the LCP hero through CdnFormatImage with the PDP primary-image config', () => {
    render(
      <OgabasseyPdpCriticalProductImage alt="Pixel 9 Pro" fallbackImage={CDN_IMAGE} />
    );

    const img = screen.getByRole('img', { name: 'Pixel 9 Pro' });
    expect(img).toHaveAttribute('src', CDN_IMAGE);

    const props = capturedProps.current.at(-1);
    expect(props).toMatchObject({
      alt: 'Pixel 9 Pro',
      'data-ogabassey-pdp-image': 'true',
      fetchPriority: 'high',
      fill: true,
      loading: 'eager',
      quality: OGABASSEY_PDP_PRIMARY_IMAGE_QUALITY,
      sizes: OGABASSEY_PDP_PRIMARY_IMAGE_SIZES,
      src: CDN_IMAGE,
    });
  });

  it('removes the hero image when the only source fails to load', () => {
    render(
      <OgabasseyPdpCriticalProductImage alt="Pixel 9 Pro" fallbackImage={CDN_IMAGE} />
    );

    fireEvent.error(screen.getByRole('img', { name: 'Pixel 9 Pro' }));

    expect(screen.queryByRole('img', { name: 'Pixel 9 Pro' })).not.toBeInTheDocument();
  });

  it('renders nothing when there is no fallback image', () => {
    const { container } = render(
      <OgabasseyPdpCriticalProductImage alt="Pixel 9 Pro" fallbackImage="" />
    );

    expect(container.firstChild).toBeNull();
  });
});
