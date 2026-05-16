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
    expect(screen.getByText('2 open')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Agentic checkouts are waiting on order finalization recovery.'
      )
    ).toBeInTheDocument();
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
