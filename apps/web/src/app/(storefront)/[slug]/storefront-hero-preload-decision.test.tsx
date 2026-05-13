import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockHeaders, mockOgabasseyStaticResourceHints } = vi.hoisted(() => ({
  mockHeaders: vi.fn(),
  mockOgabasseyStaticResourceHints: vi.fn(() => null),
}));

vi.mock('next/headers', () => ({
  headers: () => mockHeaders(),
}));

vi.mock('@/app/(storefront)/ogabassey/ogabassey-static-resource-hints', () => ({
  OgabasseyStaticResourceHints: mockOgabasseyStaticResourceHints,
}));

import { StorefrontHeroPreloadDecision } from './storefront-hero-preload-decision';

describe('StorefrontHeroPreloadDecision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHeaders.mockResolvedValue(new Headers([['x-pathname', '/ogabassey']]));
  });

  it('emits OgaBassey hero resource hints on the storefront home path', async () => {
    render(
      await StorefrontHeroPreloadDecision({
        merchantSlug: 'ogabassey',
        routeSlug: 'ogabassey',
        templateId: 'ogabassey',
      })
    );

    expect(mockHeaders).toHaveBeenCalledOnce();
    expect(mockOgabasseyStaticResourceHints).toHaveBeenCalledOnce();
  });

  it('does not read request headers when the decision is disabled', async () => {
    render(
      await StorefrontHeroPreloadDecision({
        enabled: false,
        merchantSlug: 'ogabassey',
        routeSlug: 'ogabassey',
        templateId: 'ogabassey',
      })
    );

    expect(mockHeaders).not.toHaveBeenCalled();
    expect(mockOgabasseyStaticResourceHints).not.toHaveBeenCalled();
  });

  it('skips hero hints on non-home storefront paths', async () => {
    mockHeaders.mockResolvedValueOnce(
      new Headers([['x-pathname', '/ogabassey/products/iphone-17-pro-max']])
    );

    render(
      await StorefrontHeroPreloadDecision({
        merchantSlug: 'ogabassey',
        routeSlug: 'ogabassey',
        templateId: 'ogabassey',
      })
    );

    expect(mockHeaders).toHaveBeenCalledOnce();
    expect(mockOgabasseyStaticResourceHints).not.toHaveBeenCalled();
  });

  it('skips hero hints when the pathname header is missing', async () => {
    mockHeaders.mockResolvedValueOnce(new Headers([]));

    render(
      await StorefrontHeroPreloadDecision({
        merchantSlug: 'ogabassey',
        routeSlug: 'ogabassey',
        templateId: 'ogabassey',
      })
    );

    expect(mockHeaders).toHaveBeenCalledOnce();
    expect(mockOgabasseyStaticResourceHints).not.toHaveBeenCalled();
  });

  it('rethrows when request headers cannot be resolved', async () => {
    mockHeaders.mockRejectedValueOnce(new Error('headers unavailable'));

    await expect(
      StorefrontHeroPreloadDecision({
        merchantSlug: 'ogabassey',
        routeSlug: 'ogabassey',
        templateId: 'ogabassey',
      })
    ).rejects.toThrow('headers unavailable');

    expect(mockHeaders).toHaveBeenCalledOnce();
    expect(mockOgabasseyStaticResourceHints).not.toHaveBeenCalled();
  });

  it('skips hero hints for non-OgaBassey templates', async () => {
    render(
      await StorefrontHeroPreloadDecision({
        merchantSlug: 'other-store',
        routeSlug: 'other-store',
        templateId: 'classic',
      })
    );

    expect(mockHeaders).not.toHaveBeenCalled();
    expect(mockOgabasseyStaticResourceHints).not.toHaveBeenCalled();
  });
});
