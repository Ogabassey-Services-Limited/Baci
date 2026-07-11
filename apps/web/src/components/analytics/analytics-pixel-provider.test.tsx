import { render, screen } from '@testing-library/react';
import { type ComponentType, lazy, type ReactElement, Suspense } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AnalyticsPixelProvider } from './analytics-pixel-provider';

// Resolve `next/dynamic` through the test's own React.lazy so the wrapped pixel
// modules render with the SAME React instance (Next's bundled loadable pulls a
// second React copy under vitest, which triggers an invalid-hook-call). This
// preserves the real lazy-loading semantics: the pixel module is only imported
// when the component is actually mounted.
vi.mock('next/dynamic', () => ({
  default: (loader: () => Promise<ComponentType<unknown>>) =>
    lazy(() => loader().then((Component) => ({ default: Component }))),
}));

function renderProvider(ui: ReactElement) {
  return render(<Suspense fallback={null}>{ui}</Suspense>);
}

vi.mock('./google-analytics', () => ({
  GoogleAnalytics: ({ measurementId }: { measurementId: string }) => (
    <div data-testid="google-analytics">{measurementId}</div>
  ),
}));

vi.mock('./facebook-pixel', () => ({
  FacebookPixel: ({ pixelId }: { pixelId: string }) => (
    <div data-testid="facebook-pixel">{pixelId}</div>
  ),
}));

vi.mock('./tiktok-pixel', () => ({
  TikTokPixel: ({ pixelId }: { pixelId: string }) => (
    <div data-testid="tiktok-pixel">{pixelId}</div>
  ),
}));

vi.mock('./snapchat-pixel', () => ({
  SnapchatPixel: ({ pixelId }: { pixelId: string }) => (
    <div data-testid="snapchat-pixel">{pixelId}</div>
  ),
}));

vi.mock('./twitter-pixel', () => ({
  TwitterPixel: ({ pixelId }: { pixelId: string }) => (
    <div data-testid="twitter-pixel">{pixelId}</div>
  ),
}));

describe('AnalyticsPixelProvider', () => {
  it('renders merchant analytics pixels from an explicit merchant payload', async () => {
    renderProvider(
      <AnalyticsPixelProvider
        merchant={{
          google_analytics_id: 'G-STORE',
          facebook_pixel_id: 'fb-1',
          tiktok_pixel_id: 'tt-1',
        }}
      />
    );

    // Configured pixels load their module lazily (next/dynamic), so assert with
    // async `findByText`.
    expect(await screen.findByText('G-STORE')).toBeInTheDocument();
    expect(await screen.findByText('fb-1')).toBeInTheDocument();
    expect(await screen.findByText('tt-1')).toBeInTheDocument();
    // Unconfigured pixels are never mounted, so their modules never load.
    expect(screen.queryByText('snap-1')).not.toBeInTheDocument();
    expect(screen.queryByText('tw-1')).not.toBeInTheDocument();
  });

  it('renders all supported merchant pixel types when all IDs are configured', async () => {
    renderProvider(
      <AnalyticsPixelProvider
        merchant={{
          google_analytics_id: 'G-STORE',
          facebook_pixel_id: 'fb-1',
          tiktok_pixel_id: 'tt-1',
          snapchat_pixel_id: 'snap-1',
          twitter_pixel_id: 'tw-1',
        }}
      />
    );

    expect(await screen.findByText('G-STORE')).toBeInTheDocument();
    expect(await screen.findByText('fb-1')).toBeInTheDocument();
    expect(await screen.findByText('tt-1')).toBeInTheDocument();
    expect(await screen.findByText('snap-1')).toBeInTheDocument();
    expect(await screen.findByText('tw-1')).toBeInTheDocument();
  });

  it('renders nothing when analytics IDs are empty or whitespace-only', () => {
    const { container } = renderProvider(
      <AnalyticsPixelProvider
        merchant={{
          google_analytics_id: '   ',
          facebook_pixel_id: '',
          tiktok_pixel_id: null,
        }}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when no explicit merchant analytics settings exist', () => {
    const { container } = renderProvider(
      <AnalyticsPixelProvider merchant={null} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
