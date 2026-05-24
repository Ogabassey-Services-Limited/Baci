import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AgenticCheckoutSessionsCard } from './agentic-checkout-sessions-card';

describe('AgenticCheckoutSessionsCard', () => {
  it('renders nothing when checkout sessions are omitted', () => {
    const { container } = render(<AgenticCheckoutSessionsCard />);

    expect(container.firstChild).toBeNull();
  });

  it('renders checkout recovery counts and recent sessions', () => {
    render(
      <AgenticCheckoutSessionsCard
        checkoutSessions={{
          claiming_payment_count: 1,
          order_finalizing_count: 1,
          payment_pending_count: 2,
          payment_setup_failed_count: 1,
          recent_count: 5,
          records: [
            {
              payment_state: 'payment_pending',
              session_id: 'session-1',
              status: 'pending',
              updated_at: '2026-05-12T22:45:00.000Z',
            },
            {
              payment_state: 'order_finalizing',
              session_id: 'session-2',
              status: 'processing',
              updated_at: '2026-05-12T22:44:00.000Z',
            },
            {
              payment_state: 'payment_setup_failed',
              session_id: 'session-3',
              status: 'failed',
              updated_at: '2026-05-12T22:43:00.000Z',
            },
            {
              payment_state: 'claiming_payment',
              session_id: 'session-4',
              status: 'processing',
              updated_at: '2026-05-12T22:42:00.000Z',
            },
          ],
          stale_payment_pending_count: 1,
        }}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Checkout session health' })
    ).toBeInTheDocument();
    expect(screen.getByText('5 recent sessions')).toBeInTheDocument();
    expect(screen.getByText('1 payment claim')).toBeInTheDocument();
    expect(screen.getByText('1 order finalization')).toBeInTheDocument();
    expect(screen.getByText('2 pending payments')).toBeInTheDocument();
    expect(screen.getByText('1 setup failure')).toBeInTheDocument();
    expect(screen.getByText('1 stale payment')).toBeInTheDocument();
    expect(screen.getByText('session-1')).toBeInTheDocument();
    expect(screen.getByText('moved to Payment Pending.')).toBeInTheDocument();
    expect(screen.getByText('session-2')).toBeInTheDocument();
    expect(screen.getByText('session-3')).toBeInTheDocument();
    expect(screen.queryByText('session-4')).not.toBeInTheDocument();
  });

  it('renders an empty recovery window when no checkout sessions are present', () => {
    render(
      <AgenticCheckoutSessionsCard
        checkoutSessions={{
          records: [],
          recent_count: 0,
        }}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Checkout session health' })
    ).toBeInTheDocument();
    expect(screen.getByText('0 recent sessions')).toBeInTheDocument();
    expect(
      screen.getByText('No checkout recovery activity in the current window.')
    ).toBeInTheDocument();
  });

  it('formats sparse payment states without leaking undefined text', () => {
    render(
      <AgenticCheckoutSessionsCard
        checkoutSessions={{
          records: [
            {
              payment_state: 'order__finalizing',
              session_id: 'session-9',
              status: 'processing',
              updated_at: '2026-05-12T22:45:00.000Z',
            },
          ],
        }}
      />
    );

    expect(screen.getByText('session-9')).toBeInTheDocument();
    expect(screen.getByText('moved to Order Finalizing.')).toBeInTheDocument();
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
  });
});
