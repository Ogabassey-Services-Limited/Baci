import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { mockPreconnect, mockPrefetchDNS, mockPreload } = vi.hoisted(() => ({
  mockPreconnect: vi.fn(),
  mockPrefetchDNS: vi.fn(),
  mockPreload: vi.fn(),
}));

vi.mock('react-dom', () => ({
  preconnect: mockPreconnect,
  prefetchDNS: mockPrefetchDNS,
  preload: mockPreload,
}));

import { OgabasseyStaticResourceHints } from '@/app/(storefront)/ogabassey/ogabassey-static-resource-hints';
import {
  HERO_DESKTOP_LCP_SRC,
  HERO_MOBILE_LCP_SRC,
} from '@/components/storefront/ogabassey/components/hero-data';
import { OGABASSEY_CDN_ORIGIN } from '@/components/storefront/ogabassey/config/storefront-origins';

describe('OgabasseyStaticResourceHints', () => {
  it('emits viewport-scoped hero image hints through ReactDOM', () => {
    const { container } = render(<OgabasseyStaticResourceHints />);

    expect(container).toBeEmptyDOMElement();
    expect(mockPrefetchDNS).toHaveBeenCalledTimes(1);
    expect(mockPrefetchDNS).toHaveBeenCalledWith(OGABASSEY_CDN_ORIGIN);
    expect(mockPreconnect).toHaveBeenCalledTimes(1);
    expect(mockPreconnect).toHaveBeenCalledWith(OGABASSEY_CDN_ORIGIN);
    expect(mockPreload).toHaveBeenCalledTimes(2);
    expect(mockPreload).toHaveBeenCalledWith(
      HERO_DESKTOP_LCP_SRC,
      expect.objectContaining({
        as: 'image',
        fetchPriority: 'high',
        media: '(min-width: 768px)',
        type: 'image/avif',
      })
    );
    expect(mockPreload).toHaveBeenCalledWith(
      HERO_MOBILE_LCP_SRC,
      expect.objectContaining({
        as: 'image',
        fetchPriority: 'high',
        media: '(max-width: 767px)',
        type: 'image/avif',
      })
    );
  });
});
