import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FlyToCartAnimation } from './FlyToCartAnimation';

vi.mock('@/components/storefront/cdn-format-image', () => ({
  CdnFormatImage: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}));

describe('FlyToCartAnimation', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('renders the animated product through the CDN format image path', async () => {
    const target = document.createElement('div');
    target.id = 'mobile-footer-cart-icon';
    target.getBoundingClientRect = vi.fn(
      () => new DOMRect(300, 600, 40, 40)
    );
    document.body.append(target);

    const { unmount } = render(
      <FlyToCartAnimation
        imageSrc="https://cdn.ogabassey.com/core-assets/products/phone.jpg"
        onComplete={vi.fn()}
        startRect={new DOMRect(20, 40, 40, 40)}
      />
    );

    await waitFor(() => {
      expect(
        document.querySelector(
          'img[src="https://cdn.ogabassey.com/core-assets/products/phone.jpg"]'
        )
      ).toBeInTheDocument();
    });

    unmount();
  });
});
