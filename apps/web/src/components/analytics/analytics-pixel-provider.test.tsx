import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AnalyticsPixelProvider } from './analytics-pixel-provider';

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
  it('renders merchant analytics pixels from an explicit merchant payload', () => {
    render(
      <AnalyticsPixelProvider
        merchant={{
          google_analytics_id: 'G-STORE',
          facebook_pixel_id: 'fb-1',
          tiktok_pixel_id: 'tt-1',
        }}
      />
    );

    expect(screen.getByTestId('google-analytics')).toHaveTextContent('G-STORE');
    expect(screen.getByTestId('facebook-pixel')).toHaveTextContent('fb-1');
    expect(screen.getByTestId('tiktok-pixel')).toHaveTextContent('tt-1');
    expect(screen.queryByTestId('snapchat-pixel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('twitter-pixel')).not.toBeInTheDocument();
  });

  it('renders all supported merchant pixel types when all IDs are configured', () => {
    render(
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

    expect(screen.getByTestId('google-analytics')).toBeInTheDocument();
    expect(screen.getByTestId('facebook-pixel')).toBeInTheDocument();
    expect(screen.getByTestId('tiktok-pixel')).toBeInTheDocument();
    expect(screen.getByTestId('snapchat-pixel')).toBeInTheDocument();
    expect(screen.getByTestId('twitter-pixel')).toBeInTheDocument();
  });

  it('renders nothing when analytics IDs are empty or whitespace-only', () => {
    const { container } = render(
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
    const { container } = render(<AnalyticsPixelProvider merchant={null} />);

    expect(container).toBeEmptyDOMElement();
  });
});
