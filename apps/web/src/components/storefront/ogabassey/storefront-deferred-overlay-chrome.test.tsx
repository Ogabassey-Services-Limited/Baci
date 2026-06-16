import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./components/PopupSystem', () => ({
  PopupSystem: () => <section aria-label="Popup system" />,
}));

vi.mock('./components/OfflineNotice', () => ({
  OfflineNotice: () => <output aria-label="Offline notice" />,
}));

import { StorefrontDeferredOverlayChrome } from './storefront-deferred-overlay-chrome';

describe('StorefrontDeferredOverlayChrome', () => {
  it('mounts popup and offline chrome behind the deferred overlay boundary', async () => {
    render(<StorefrontDeferredOverlayChrome />);

    expect(
      await screen.findByRole('region', { name: /popup system/i })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('status', { name: /offline notice/i })
    ).toBeInTheDocument();
  });
});
