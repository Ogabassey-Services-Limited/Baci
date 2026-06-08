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
  Footer: () => <footer aria-label="Store footer" />,
}));

import { StorefrontDeferredFooterChrome } from './storefront-deferred-footer-chrome';

describe('StorefrontDeferredFooterChrome', () => {
  it('mounts footer commerce features behind the deferred chrome boundary', async () => {
    render(<StorefrontDeferredFooterChrome basePath="/ogabassey" />);

    expect(
      await screen.findByRole('complementary', { name: /footer ad unit/i })
    ).toHaveTextContent('FOOTER_BANNER');
    expect(
      await screen.findByRole('contentinfo', { name: /store footer/i })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('dialog', { name: /deferred cart sidebar/i })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('complementary', {
        name: /deferred chat widget/i,
      })
    ).toBeInTheDocument();
  });

  it('mounts the footer when merchant data is unavailable', async () => {
    render(
      <StorefrontDeferredFooterChrome
        basePath="/ogabassey"
        merchant={undefined}
      />
    );

    expect(
      await screen.findByRole('contentinfo', { name: /store footer/i })
    ).toBeInTheDocument();
  });
});
