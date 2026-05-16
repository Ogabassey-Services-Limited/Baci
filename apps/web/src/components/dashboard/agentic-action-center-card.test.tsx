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
    expect(screen.getByText('2 open')).toBeInTheDocument();
    expect(screen.getByText('2 affected')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /review/i })[0]).toHaveAttribute(
      'href',
      '/dashboard/orders?source=agentic'
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
      '/dashboard/orders?source=agentic'
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
      '/dashboard/settings/trust'
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
