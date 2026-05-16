import { cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgenticActionCenterCard } from './agentic-action-center-card';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('AgenticActionCenterCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders attention actions with an order review link', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
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
            message: 'Agentic checkouts are waiting for payment confirmation.',
            severity: 'monitor',
          },
        ],
        generated_at: '2026-05-12T22:50:00.000Z',
      }),
    } as Response);

    render(<AgenticActionCenterCard />);

    expect(await screen.findByText('Agent action center')).toBeInTheDocument();
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
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/merchant/agentic/action-health',
      { credentials: 'include' }
    );
  });

  it('renders a clear state when no agentic action needs attention', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        actions: [
          {
            code: 'AGENTIC_ACTIONS_HEALTHY',
            count: 0,
            message: 'No recent agentic action issues need attention.',
            severity: 'ok',
          },
        ],
      }),
    } as Response);

    render(<AgenticActionCenterCard />);

    expect(await screen.findByText('Clear')).toBeInTheDocument();
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

  it('renders a monitor state when actions need watching but not attention', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        actions: [
          {
            code: 'AGENTIC_PAYMENT_PENDING',
            count: 3,
            message: 'Agentic checkouts are waiting for payment confirmation.',
            severity: 'monitor',
          },
        ],
      }),
    } as Response);

    render(<AgenticActionCenterCard />);

    expect(await screen.findByText('3 monitor')).toBeInTheDocument();
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

  it('renders stale payment-pending sessions as attention items', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        actions: [
          {
            code: 'AGENTIC_PAYMENT_PENDING_STALE',
            count: 1,
            message:
              'Agentic checkouts have been waiting for payment confirmation too long.',
            severity: 'attention',
          },
        ],
      }),
    } as Response);

    render(<AgenticActionCenterCard />);

    expect(await screen.findByText('1 open')).toBeInTheDocument();
    expect(
      screen.getAllByText(
        'Agentic checkouts have been waiting for payment confirmation too long.'
      )
    ).toHaveLength(2);
    expect(screen.getByRole('link', { name: /review/i })).toHaveAttribute(
      'href',
      '/dashboard/orders?source=agentic'
    );
  });

  it('renders allowlist control warnings without a dead-end review link', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        actions: [
          {
            code: 'AGENTIC_AGENT_ALLOWLIST_UNSET',
            count: 1,
            message:
              'No agent allowlist is configured. Contact support to configure trusted agent user-agents for this merchant.',
            severity: 'monitor',
          },
        ],
      }),
    } as Response);

    render(<AgenticActionCenterCard />);

    expect(await screen.findByText('1 monitor')).toBeInTheDocument();
    expect(
      screen.getByText(
        'No agent allowlist is configured. Contact support to configure trusted agent user-agents for this merchant.'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /review/i })
    ).not.toBeInTheDocument();
  });

  it('treats negative action counts as a malformed payload', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        actions: [
          {
            code: 'AGENTIC_IDEMPOTENCY_ERRORS',
            count: -2,
            message: 'Recent agentic retries ended with server errors.',
            severity: 'attention',
          },
          {
            code: 'AGENTIC_ORDER_FINALIZING',
            count: 1,
            message:
              'Agentic checkouts are waiting on order finalization recovery.',
            severity: 'attention',
          },
        ],
      }),
    } as Response);

    render(<AgenticActionCenterCard />);

    expect(
      await screen.findByText(
        'Agentic action health is temporarily unavailable.'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText('1 agentic checkout issue needs attention.')
    ).not.toBeInTheDocument();
  });

  it.each([
    401, 403,
  ])('renders nothing when the action health route returns %i', async (status) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status,
      json: async () => ({ error: 'Unauthorized' }),
    } as Response);

    const { container } = render(<AgenticActionCenterCard />);

    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it('shows a temporary unavailable state for malformed payloads', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ actions: [{ code: 'BROKEN' }] }),
    } as Response);

    render(<AgenticActionCenterCard />);

    expect(
      await screen.findByText(
        'Agentic action health is temporarily unavailable.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(
      screen.getByText('Agentic checkout health could not be loaded.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Clear')).not.toBeInTheDocument();
  });
});
