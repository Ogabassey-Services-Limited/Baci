import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./components/AdUnit', () => ({
  AdUnit: ({ placementKey }: { placementKey: string }) => (
    <aside aria-label="Footer ad unit">{placementKey}</aside>
  ),
}));

vi.mock('./components/deferred-cart-sidebar', () => ({
  DeferredCartSidebar: () => (
    <div aria-label="Deferred cart sidebar" role="dialog" />
  ),
}));

vi.mock('./components/chat/DeferredChatWidget', () => ({
  DeferredChatWidget: () => <aside aria-label="Deferred chat widget" />,
}));

vi.mock('./components/Footer', () => ({
  Footer: ({ storeSlug }: { storeSlug: string }) => (
    <footer aria-label="Full storefront footer">
      <a href={`${storeSlug}/about`}>About Us</a>
    </footer>
  ),
}));

import { StorefrontDeferredFooterChrome } from './storefront-deferred-footer-chrome';

describe('StorefrontDeferredFooterChrome', () => {
  it('mounts the full footer and footer commerce widgets behind the deferred chrome boundary', async () => {
    render(<StorefrontDeferredFooterChrome basePath="/ogabassey" />);

    expect(
      await screen.findByRole('contentinfo', {
        name: /full storefront footer/i,
      })
    ).toContainElement(screen.getByRole('link', { name: /about us/i }));

    expect(
      await screen.findByRole('complementary', { name: /footer ad unit/i })
    ).toHaveTextContent('FOOTER_BANNER');
    expect(
      await screen.findByRole('dialog', { name: /deferred cart sidebar/i })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('complementary', {
        name: /deferred chat widget/i,
      })
    ).toBeInTheDocument();
  });

  it('reserves the footer ad slot per breakpoint (100px mobile, 250px desktop) so content-visibility never over-reserves', async () => {
    render(<StorefrontDeferredFooterChrome basePath="/ogabassey" />);

    const adUnitWrapper = (
      await screen.findByRole('complementary', { name: /footer ad unit/i })
    ).parentElement;

    // Mobile reservation matches the 320x100 FOOTER_BANNER slot...
    expect(adUnitWrapper).toHaveClass('min-h-[100px]');
    expect(adUnitWrapper).toHaveClass('[contain-intrinsic-size:1400px_100px]');
    // ...and the desktop override matches the 970x250 slot.
    expect(adUnitWrapper).toHaveClass('md:min-h-[250px]');
    expect(adUnitWrapper).toHaveClass(
      'md:[contain-intrinsic-size:1400px_250px]'
    );
    expect(adUnitWrapper).toHaveClass('content-auto');
  });
});
