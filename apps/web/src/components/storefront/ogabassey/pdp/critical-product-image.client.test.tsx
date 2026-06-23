import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    <img
      {...Object.fromEntries(
        Object.entries(props).filter(([key]) => key !== 'fill')
      )}
      alt={String(props.alt ?? '')}
    />
  ),
}));

const commerce = vi.hoisted(
  () => ({ value: null }) as { value: { productForCart: { image: string } } | null }
);

vi.mock('./critical-commerce-state.client', () => ({
  useOptionalOgabasseyPdpCriticalCommerce: () => commerce.value,
  useOgabasseyPdpCriticalCommerce: () => commerce.value,
  OgabasseyPdpCriticalCommerceProvider: ({
    children,
  }: {
    children: ReactNode;
  }) => children,
}));

import { OgabasseyPdpCriticalProductImage } from './critical-commerce.client';

const VARIANT_IMAGE = 'https://cdn.ogabassey.com/variant.avif';
const BASE_IMAGE = 'https://cdn.ogabassey.com/base.avif';

describe('OgabasseyPdpCriticalProductImage', () => {
  it('renders the selected variant image above the fold', () => {
    commerce.value = { productForCart: { image: VARIANT_IMAGE } };

    render(
      <OgabasseyPdpCriticalProductImage
        alt="Test phone"
        fallbackImage={BASE_IMAGE}
      />
    );

    expect(screen.getByAltText('Test phone')).toHaveAttribute(
      'src',
      VARIANT_IMAGE
    );
  });

  it('falls back to the base image when the above-the-fold image 404s', () => {
    commerce.value = { productForCart: { image: VARIANT_IMAGE } };

    render(
      <OgabasseyPdpCriticalProductImage
        alt="Test phone"
        fallbackImage={BASE_IMAGE}
      />
    );

    const image = screen.getByAltText('Test phone');
    expect(image).toHaveAttribute('src', VARIANT_IMAGE);

    // The CDN 404s the variant image -> the LCP image must fall back to the
    // product's base image instead of staying broken above the fold.
    act(() => {
      fireEvent.error(image);
    });

    expect(screen.getByAltText('Test phone')).toHaveAttribute(
      'src',
      BASE_IMAGE
    );
  });
});
