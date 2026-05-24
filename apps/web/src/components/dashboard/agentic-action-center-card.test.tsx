import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AgenticActionCenterCard } from './agentic-action-center-card';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('AgenticActionCenterCard', () => {
  it('renders attention actions with an order review link', () => {
    render(
      <AgenticActionCenterCard
        payload={{
          actions: [
            {
              code: 'AGENTIC_ORDER_FINALIZING',
              count: 2,
              message:
                'Agentic checkouts are waiting on order finalization recovery.',
              next_step:
                'Check whether an order was created before allowing another completion retry.',
              severity: 'attention',
            },
            {
              code: 'AGENTIC_PAYMENT_PENDING',
              count: 1,
              message:
                'Agentic checkouts are waiting for payment confirmation.',
              severity: 'monitor',
            },
          ],
          checkout_sessions: {
            records: [
              {
                payment_state: 'order_finalizing',
                session_id: 'session-2',
                status: 'processing',
                updated_at: '2026-05-12T22:45:00.000Z',
              },
            ],
          },
          generated_at: '2026-05-12T22:50:00.000Z',
        }}
        state="ready"
      />
    );

    expect(screen.getByText('Agent action center')).toBeInTheDocument();
    expect(screen.getByText('What changed')).toBeInTheDocument();
    expect(screen.getAllByText('Needs attention')).toHaveLength(2);
    expect(screen.getByText('Next move')).toBeInTheDocument();
    expect(
      screen.getByText('2 agentic checkout issues need attention.')
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        'Agentic checkouts are waiting on order finalization recovery.'
      )
    ).toHaveLength(2);
    expect(
      screen.getByText(
        'Next step: Check whether an order was created before allowing another completion retry.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText('Review affected checkout activity before agents retry.')
    ).toBeInTheDocument();
    expect(screen.getByText('Recent activity')).toBeInTheDocument();
    expect(screen.getByText('session-2')).toBeInTheDocument();
    expect(screen.getByText('moved to Order Finalizing.')).toBeInTheDocument();
    expect(screen.getByText('2 open')).toBeInTheDocument();
    expect(screen.getByText('2 affected')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /review/i })[0]).toHaveAttribute(
      'href',
      '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_ORDER_FINALIZING'
    );
  });

  it('renders a clear state when no agentic action needs attention', () => {
    render(
      <AgenticActionCenterCard
        payload={{
          actions: [
            {
              code: 'AGENTIC_ACTIONS_HEALTHY',
              count: 0,
              message: 'No recent agentic action issues need attention.',
              severity: 'ok',
            },
          ],
        }}
        state="ready"
      />
    );

    expect(screen.getByText('Clear')).toBeInTheDocument();
    expect(
      screen.getByText('No new agentic recovery issues since the last refresh.')
    ).toBeInTheDocument();
    expect(screen.getByText('No action needed right now.')).toBeInTheDocument();
    expect(
      screen.getByText('Keep catalog, trust, and payment settings current.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('No recent agentic action issues need attention.')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /review/i })
    ).not.toBeInTheDocument();
  });

  it('renders a monitor state when actions need watching but not attention', () => {
    render(
      <AgenticActionCenterCard
        payload={{
          actions: [
            {
              code: 'AGENTIC_PAYMENT_PENDING',
              count: 3,
              message:
                'Agentic checkouts are waiting for payment confirmation.',
              severity: 'monitor',
            },
          ],
        }}
        state="ready"
      />
    );

    expect(screen.getByText('3 monitor')).toBeInTheDocument();
    expect(
      screen.getByText('3 agentic checkout items are active.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('No blockers, but payment or order status is moving.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Review pending activity if the count does not fall.')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Agentic checkout activity is active and should be monitored.'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText('Clear')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /review/i })).toHaveAttribute(
      'href',
      '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_PAYMENT_PENDING'
    );
  });

  it('renders allowlist control warnings with a trust-settings review link', () => {
    render(
      <AgenticActionCenterCard
        payload={{
          actions: [
            {
              code: 'AGENTIC_AGENT_ALLOWLIST_UNSET',
              count: 1,
              message: 'No agent allowlist is configured in Trust settings.',
              severity: 'monitor',
            },
          ],
        }}
        state="ready"
      />
    );

    expect(screen.getByText('1 monitor')).toBeInTheDocument();
    expect(
      screen.getByText('No agent allowlist is configured in Trust settings.')
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /review/i })).toHaveAttribute(
      'href',
      '/dashboard/settings/trust#agent-checkout-controls'
    );
  });

  it('formats recent payment-state labels safely when metadata has empty tokens', () => {
    render(
      <AgenticActionCenterCard
        payload={{
          actions: [
            {
              code: 'AGENTIC_PAYMENT_PENDING',
              count: 1,
              message:
                'Agentic checkouts are waiting for payment confirmation.',
              severity: 'monitor',
            },
          ],
          checkout_sessions: {
            records: [
              {
                payment_state: 'order__finalizing',
                session_id: 'session-9',
                status: 'processing',
                updated_at: '2026-05-12T22:45:00.000Z',
              },
            ],
          },
          generated_at: '2026-05-12T22:50:00.000Z',
        }}
        state="ready"
      />
    );

    expect(screen.getByText('session-9')).toBeInTheDocument();
    expect(screen.getByText('moved to Order Finalizing.')).toBeInTheDocument();
    expect(screen.queryByText(/undefined/i)).not.toBeInTheDocument();
  });

  it('renders idempotency pressure records for unresolved states', () => {
    render(
      <AgenticActionCenterCard
        payload={{
          actions: [
            {
              code: 'AGENTIC_REQUESTS_IN_PROGRESS',
              count: 2,
              message:
                'Agentic idempotency reservations are still in progress.',
              severity: 'monitor',
            },
          ],
          idempotency: {
            records: [
              {
                created_at: '2026-05-12T22:40:00.000Z',
                expires_at: '2026-05-12T22:50:00.000Z',
                route: 'checkout_sessions.complete',
                state: 'server_error',
                status_code: 502,
                updated_at: '2026-05-12T22:45:00.000Z',
              },
              {
                created_at: '2026-05-12T22:41:00.000Z',
                expires_at: '2026-05-12T22:51:00.000Z',
                route: 'checkout_sessions.cancel',
                state: 'in_progress',
                status_code: null,
                updated_at: '2026-05-12T22:46:00.000Z',
              },
              {
                created_at: '2026-05-12T22:42:00.000Z',
                expires_at: '2026-05-12T22:52:00.000Z',
                route: 'checkout_sessions.complete',
                state: 'client_error',
                status_code: 409,
                updated_at: '2026-05-12T22:47:00.000Z',
              },
              {
                created_at: '2026-05-12T22:43:00.000Z',
                expires_at: '2026-05-12T22:53:00.000Z',
                route: 'checkout_sessions.update',
                state: 'completed',
                status_code: 200,
                updated_at: '2026-05-12T22:48:00.000Z',
              },
            ],
          },
        }}
        state="ready"
      />
    );

    expect(screen.getByText('Idempotency pressure')).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) =>
          element?.textContent?.trim() ===
          'checkout_sessions.complete is Server Error (status 502).'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) =>
          element?.textContent?.trim() ===
          'checkout_sessions.cancel is In Progress (pending).'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'checkout_sessions.complete is Client Error (status 409).'
      )
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('checkout_sessions.update is Completed (status 200).')
    ).not.toBeInTheDocument();
  });

  it('renders request controls and recent signed request visibility', () => {
    render(
      <AgenticActionCenterCard
        payload={{
          actions: [
            {
              code: 'AGENTIC_ACTIONS_HEALTHY',
              count: 0,
              message: 'No recent agentic action issues need attention.',
              severity: 'ok',
            },
          ],
          request_controls: {
            allowlist_count: 2,
            denylist_count: 1,
            fetch_error: false,
            is_agentic_checkout_enabled: true,
          },
          requests: {
            recent_count: 2,
            records: [
              {
                api_version: '2026-04-30',
                created_at: '2026-05-12T22:40:00.000Z',
                expires_at: '2026-05-12T22:50:00.000Z',
              },
              {
                api_version: null,
                created_at: '2026-05-12T22:41:00.000Z',
                expires_at: '2026-05-12T22:51:00.000Z',
              },
            ],
          },
        }}
        state="ready"
      />
    );

    expect(screen.getByText('Request controls')).toBeInTheDocument();
    expect(screen.getByText('Agent checkout enabled')).toBeInTheDocument();
    expect(screen.getByText('2 trusted patterns')).toBeInTheDocument();
    expect(screen.getByText('1 blocked pattern')).toBeInTheDocument();
    expect(screen.getByText('Recent signed requests')).toBeInTheDocument();
    expect(screen.getByText('2 recent requests')).toBeInTheDocument();
    expect(screen.getByText('API 2026-04-30')).toBeInTheDocument();
    expect(screen.getByText('API unknown')).toBeInTheDocument();
  });

  it('renders request controls error when refresh fails', () => {
    render(
      <AgenticActionCenterCard
        payload={{
          actions: [
            {
              code: 'AGENTIC_ACTIONS_HEALTHY',
              count: 0,
              message: 'No recent agentic action issues need attention.',
              severity: 'ok',
            },
          ],
          request_controls: {
            allowlist_count: 2,
            denylist_count: 1,
            fetch_error: true,
            is_agentic_checkout_enabled: true,
          },
        }}
        state="ready"
      />
    );

    expect(
      screen.getByText('Controls could not be refreshed.')
    ).toBeInTheDocument();
  });

  it('uses next_step_url from the payload when present', () => {
    render(
      <AgenticActionCenterCard
        payload={{
          actions: [
            {
              code: 'AGENTIC_ORDER_FINALIZING',
              count: 1,
              message:
                'Agentic checkouts are waiting on order finalization recovery.',
              next_step_url:
                '/dashboard/orders?source=agentic&focus=finalizing',
              severity: 'attention',
            },
          ],
        }}
        state="ready"
      />
    );

    expect(screen.getByText('1 open')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /review/i })).toHaveAttribute(
      'href',
      '/dashboard/orders?source=agentic&focus=finalizing'
    );
  });

  it('renders an unavailable state when loading fails', () => {
    render(<AgenticActionCenterCard payload={null} state="error" />);

    expect(
      screen.getByText('Agentic action health is temporarily unavailable.')
    ).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(
      screen.getByText('Agentic checkout health could not be loaded.')
    ).toBeInTheDocument();
  });

  it('renders nothing when state is unauthorized', () => {
    const { container } = render(
      <AgenticActionCenterCard payload={null} state="unauthorized" />
    );

    expect(container.firstChild).toBeNull();
  });
});
