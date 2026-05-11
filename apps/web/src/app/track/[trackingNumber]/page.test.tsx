import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TrackingPage from '@/app/track/[trackingNumber]/page';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('TrackingPage', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders a local fallback while route params are pending', () => {
    render(
      <TrackingPage
        params={
          new Promise(() => {
            // Intentionally unresolved to keep the Suspense fallback visible.
          })
        }
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Tracking your shipment'
    );
  });

  it('displays tracking data when the shipping API resolves', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        trackingNumber: 'TRACK123',
        carrier: 'DHL',
        provider: 'dhl',
        status: 'in_transit',
        statusLabel: 'In Transit',
        estimatedDelivery: '2026-05-12T10:00:00Z',
        events: [
          {
            status: 'in_transit',
            description: 'Package in transit',
            location: 'Lagos',
            timestamp: '2026-05-10T10:00:00Z',
          },
        ],
        shipment: {
          id: 'shipment-1',
          orderId: 'order-1',
          receiverCity: 'Ikeja',
          receiverState: 'Lagos',
        },
      }),
    } as Response);

    // React 19's use(params) boundary does not settle in jsdom until this
    // initial render is flushed through act.
    await act(() => {
      render(
        <TrackingPage
          params={Promise.resolve({ trackingNumber: 'TRACK123' })}
        />
      );
    });

    expect(
      await screen.findByRole('heading', { name: 'In Transit' })
    ).toBeInTheDocument();
    expect(screen.getByText('TRACK123')).toBeInTheDocument();
    expect(screen.getByText('Package in transit')).toBeInTheDocument();
    expect(screen.getByText(/Delivering to Ikeja, Lagos/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/shipping/track/TRACK123');
  });

  it('displays tracking errors returned by the shipping API', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Tracking number not found' }),
    } as Response);

    render(
      <TrackingPage params={Promise.resolve({ trackingNumber: 'INVALID' })} />
    );

    expect(
      await screen.findByRole('heading', { name: 'Tracking Not Found' })
    ).toBeInTheDocument();
    expect(screen.getByText('Tracking number not found')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/shipping/track/INVALID');
  });
});
