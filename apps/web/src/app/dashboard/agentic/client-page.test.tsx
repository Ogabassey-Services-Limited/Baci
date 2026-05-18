import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AgenticDashboardClientPage from './client-page';

vi.mock('@/components/dashboard/agentic-action-center-card', () => ({
  AgenticActionCenterCard: () => <section>Action card content</section>,
}));

vi.mock('@/components/dashboard/agentic-trust-center-card', () => ({
  AgenticTrustCenterCard: () => <section>Trust card content</section>,
}));

const baseProps = {
  actionCenterState: 'ready' as const,
  actionHealth: {
    actions: [
      {
        code: 'AGENTIC_ACTIONS_HEALTHY',
        count: 0,
        message: 'No recent agentic action issues need attention.',
        severity: 'ok' as const,
      },
    ],
  },
  isPublished: true,
  trustCenterState: 'ready' as const,
  trustReadiness: {
    checks: [],
    status: 'pass' as const,
    totals: {
      googleProducts: 0,
      latestProductUpdatedAt: null,
      openAiProducts: 0,
      priceMismatches: 0,
      productsWithStructuredData: 0,
      productsWithVerifiedImages: 0,
      sharedProducts: 0,
      staleProducts: 0,
      urlMismatches: 0,
    },
  },
};

describe('AgenticDashboardClientPage', () => {
  it('renders action and trust center tabs for published stores', async () => {
    const user = userEvent.setup();
    render(<AgenticDashboardClientPage {...baseProps} />);

    expect(
      screen.getByRole('heading', { name: 'Agentic commerce' })
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /action center/i })).toBeVisible();
    expect(screen.getByRole('tab', { name: /trust center/i })).toBeVisible();
    expect(screen.getByText('Action card content')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /trust center/i }));

    expect(screen.getByText('Trust card content')).toBeInTheDocument();
  });

  it('shows a paused state before the storefront is published', () => {
    render(
      <AgenticDashboardClientPage
        {...baseProps}
        actionHealth={null}
        isPublished={false}
        trustReadiness={null}
      />
    );

    expect(screen.getByText('Agentic centers are paused')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('shows unauthorized state before the unpublished pause state', () => {
    render(
      <AgenticDashboardClientPage
        {...baseProps}
        actionCenterState="unauthorized"
        actionHealth={null}
        isPublished={false}
        trustCenterState="unauthorized"
        trustReadiness={null}
      />
    );

    expect(
      screen.getByText('Agentic centers are unavailable')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Agentic centers are paused')
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('keeps trust center visible when only action center is unauthorized', () => {
    render(
      <AgenticDashboardClientPage
        {...baseProps}
        actionCenterState="unauthorized"
        actionHealth={null}
      />
    );

    expect(
      screen.queryByText('Agentic centers are unavailable')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: /action center/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /trust center/i })).toBeVisible();
    expect(screen.getByText('Trust card content')).toBeInTheDocument();
    expect(screen.queryByText('Action card content')).not.toBeInTheDocument();
  });
});
