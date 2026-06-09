import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TrackPage, { metadata } from './page';

vi.mock('./client-page', () => ({
  default: () => <main>Track order client</main>,
}));

describe('TrackPage metadata wrapper', () => {
  it('declares noindex tracking metadata', () => {
    expect(metadata).toMatchObject({
      title: 'Track Your Order - Baci',
      description:
        'Track a Baci shipment by entering the tracking number sent after checkout.',
      alternates: {
        canonical: expect.stringContaining('/track'),
      },
      robots: {
        index: false,
        follow: false,
      },
    });
  });

  it('renders the client page boundary', () => {
    render(<TrackPage />);

    expect(screen.getByRole('main')).toHaveTextContent('Track order client');
  });

  it('emits parsable WebPage JSON-LD for tracking discovery', () => {
    render(<TrackPage />);

    const script = document.querySelector('script[type="application/ld+json"]');
    const jsonLd = JSON.parse(script?.textContent ?? '{}');

    expect(jsonLd).toMatchObject({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Track Your Order - Baci',
      url: expect.stringContaining('/track'),
    });
  });
});
