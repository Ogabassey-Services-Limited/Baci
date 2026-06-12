import { renderToString } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mockPreload = vi.hoisted(() => vi.fn());

vi.mock('react-dom', () => ({
  preload: mockPreload,
}));

import {
  OgabasseyPdpStaticResourceHints,
  preloadOgabasseyPdpStaticResources,
} from '@/app/(storefront)/ogabassey/ogabassey-pdp-static-resource-hints';

describe('OgabasseyPdpStaticResourceHints', () => {
  beforeEach(() => {
    mockPreload.mockClear();
  });

  it('does not render competing static PDP image preload links', () => {
    const html = renderToString(<OgabasseyPdpStaticResourceHints />);

    expect(html).toBe('');
  });

  it('does not call react-dom preload for decorative PDP campaign images', () => {
    preloadOgabasseyPdpStaticResources();

    expect(mockPreload).not.toHaveBeenCalled();
  });
});
