import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { RepairStatusResult } from '@/lib/repairs/status-lookup';
import { RepairStatusTimeline } from './repair-status-timeline';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const baseResult: RepairStatusResult = {
  ticketNumber: 1042,
  status: 'in_progress',
  deviceLabel: 'Smartphone iPhone 15',
  repairTypeLabel: 'Screen Replacement',
  serviceType: 'pickup',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-05T00:00:00.000Z',
  trackingNumber: null,
};

describe('RepairStatusTimeline', () => {
  it('renders the ticket, device and current status', () => {
    render(<RepairStatusTimeline result={baseResult} />);
    expect(screen.getByText('Ticket #1042')).toBeInTheDocument();
    expect(screen.getByText('Smartphone iPhone 15')).toBeInTheDocument();
    // Appears in both the status badge and the timeline step.
    expect(screen.getAllByText('In progress').length).toBeGreaterThan(0);
  });

  it('renders a terminal banner for cancelled repairs instead of the stepper', () => {
    render(
      <RepairStatusTimeline result={{ ...baseResult, status: 'cancelled' }} />
    );
    expect(
      screen.getByText('This repair request has been cancelled.')
    ).toBeInTheDocument();
  });

  it('shows a tracking link when a shipment tracking number is present', () => {
    render(
      <RepairStatusTimeline
        result={{ ...baseResult, trackingNumber: 'TRK-1' }}
        trackHref="/track/TRK-1"
      />
    );
    const link = screen.getByRole('link', { name: /Track courier pickup/i });
    expect(link).toHaveAttribute('href', '/track/TRK-1');
  });

  it('omits the tracking link when there is no tracking number', () => {
    render(<RepairStatusTimeline result={baseResult} trackHref="/track/x" />);
    expect(
      screen.queryByRole('link', { name: /Track courier pickup/i })
    ).not.toBeInTheDocument();
  });
});
