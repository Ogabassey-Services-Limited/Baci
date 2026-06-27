import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MigrationJobSummary from '@/app/dashboard/migrations/migration-job-summary';

describe('MigrationJobSummary', () => {
  it('renders selected job metrics and action buttons', () => {
    const onCommit = vi.fn().mockResolvedValue(undefined);
    const onNotify = vi.fn().mockResolvedValue(undefined);
    const onRefresh = vi.fn().mockResolvedValue(undefined);

    render(
      <MigrationJobSummary
        activeFilter="all"
        acting={false}
        error={null}
        loading={false}
        onFilterChange={vi.fn()}
        onCommit={onCommit}
        onNotify={onNotify}
        onRefresh={onRefresh}
        selectedJob={{
          id: 'job-1',
          entity_type: 'orders',
          source_platform: 'bumpa',
          status: 'preview_ready',
          original_filename: 'orders.csv',
          processed_rows: 25,
          total_rows: 25,
          summary: {
            validRows: 20,
            invalidRows: 5,
            receiptReadyOrders: 12,
          },
          error: null,
          created_at: '2026-03-22T10:00:00.000Z',
          committed_at: null,
          notified_at: null,
          canCommit: true,
          canNotify: false,
        }}
      />
    );

    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^import$/i }));
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }));

    expect(onCommit).toHaveBeenCalled();
    expect(onRefresh).toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: /notify customers/i })
    ).toBeDisabled();
  });

  it('shows placeholder copy when no job is selected', () => {
    render(
      <MigrationJobSummary
        activeFilter="all"
        acting={false}
        error="Something failed"
        loading={false}
        onFilterChange={vi.fn()}
        onCommit={vi.fn().mockResolvedValue(undefined)}
        onNotify={vi.fn().mockResolvedValue(undefined)}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
        selectedJob={null}
      />
    );

    expect(screen.getByText('Something failed')).toBeInTheDocument();
    expect(
      screen.getByText(/select a job to inspect its preview rows/i)
    ).toBeInTheDocument();
  });

  it('shows a progress bar when the selected job is still running', () => {
    render(
      <MigrationJobSummary
        activeFilter="all"
        acting={false}
        error={null}
        loading={false}
        onFilterChange={vi.fn()}
        onCommit={vi.fn().mockResolvedValue(undefined)}
        onNotify={vi.fn().mockResolvedValue(undefined)}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
        selectedJob={{
          id: 'job-2',
          entity_type: 'orders',
          source_platform: 'bumpa',
          status: 'validating',
          original_filename: 'orders.csv',
          processed_rows: 2911,
          total_rows: 5821,
          summary: {
            validRows: 0,
            invalidRows: 0,
            receiptReadyOrders: 0,
          },
          error: null,
          created_at: '2026-03-22T10:00:00.000Z',
          committed_at: null,
          notified_at: null,
          canCommit: false,
          canNotify: false,
        }}
      />
    );

    expect(screen.getByText(/building preview/i)).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(
      screen.getByText('2,911 of 5,821 rows processed')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: /migration progress/i })
    ).toBeInTheDocument();
  });

  it('lets merchants focus the summary on rows that need fixes', () => {
    const onFilterChange = vi.fn();

    render(
      <MigrationJobSummary
        activeFilter="needs_fix"
        acting={false}
        error={null}
        loading={false}
        onFilterChange={onFilterChange}
        onCommit={vi.fn().mockResolvedValue(undefined)}
        onNotify={vi.fn().mockResolvedValue(undefined)}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
        selectedJob={{
          id: 'job-3',
          entity_type: 'orders',
          source_platform: 'bumpa',
          status: 'preview_ready',
          original_filename: 'orders.csv',
          processed_rows: 25,
          total_rows: 25,
          summary: {
            validRows: 20,
            invalidRows: 5,
            receiptReadyOrders: 12,
          },
          error: null,
          created_at: '2026-03-22T10:00:00.000Z',
          committed_at: null,
          notified_at: null,
          canCommit: true,
          canNotify: false,
        }}
      />
    );

    expect(screen.getByText(/these rows will be skipped/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /show ready rows/i }));

    expect(onFilterChange).toHaveBeenCalledWith('importable');
  });

  it('shows indeterminate progress bar when validating with no total rows', () => {
    render(
      <MigrationJobSummary
        activeFilter="all"
        acting={false}
        error={null}
        loading={false}
        onFilterChange={vi.fn()}
        onCommit={vi.fn().mockResolvedValue(undefined)}
        onNotify={vi.fn().mockResolvedValue(undefined)}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
        selectedJob={{
          id: 'job-5',
          entity_type: 'orders',
          source_platform: 'bumpa',
          status: 'validating',
          original_filename: 'orders.csv',
          processed_rows: 0,
          total_rows: 0,
          summary: null,
          error: null,
          created_at: '2026-03-22T10:00:00.000Z',
          committed_at: null,
          notified_at: null,
          canCommit: false,
          canNotify: false,
        }}
      />
    );

    expect(screen.getByText(/building preview/i)).toBeInTheDocument();
    // Should NOT show "0%" — indeterminate state hides percentage
    expect(screen.queryByText('0%')).not.toBeInTheDocument();
    // Should show loading detail text
    expect(screen.getByText(/loading and parsing file/i)).toBeInTheDocument();
    // Progress bar should be present with null value (indeterminate)
    const progressBar = screen.getByRole('progressbar', {
      name: /migration progress/i,
    });
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).not.toHaveAttribute('aria-valuenow');
  });

  it('shows empty-filter guidance and disables empty filter cards', () => {
    render(
      <MigrationJobSummary
        activeFilter="importable"
        acting={false}
        error={null}
        loading={false}
        onFilterChange={vi.fn()}
        onCommit={vi.fn().mockResolvedValue(undefined)}
        onNotify={vi.fn().mockResolvedValue(undefined)}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
        selectedJob={{
          id: 'job-4',
          entity_type: 'orders',
          source_platform: 'bumpa',
          status: 'preview_ready',
          original_filename: 'orders.csv',
          processed_rows: 12,
          total_rows: 12,
          summary: {
            validRows: 0,
            invalidRows: 0,
            receiptReadyOrders: 0,
          },
          error: null,
          created_at: '2026-03-22T10:00:00.000Z',
          committed_at: null,
          notified_at: null,
          canCommit: false,
          canNotify: false,
        }}
      />
    );

    expect(screen.getByText(/^No rows ready to import$/i)).toBeInTheDocument();
    expect(
      screen.getByText(/currently has no rows ready to import/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /ready to import/i })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: /needs fix/i })).toBeDisabled();
  });

  it('renders receipt campaign tracking stats and recipient status', () => {
    render(
      <MigrationJobSummary
        activeFilter="all"
        acting={false}
        error={null}
        loading={false}
        onFilterChange={vi.fn()}
        onCommit={vi.fn().mockResolvedValue(undefined)}
        onNotify={vi.fn().mockResolvedValue(undefined)}
        onRefresh={vi.fn().mockResolvedValue(undefined)}
        selectedJob={{
          id: 'job-6',
          entity_type: 'orders',
          source_platform: 'bumpa',
          status: 'completed',
          original_filename: 'orders.csv',
          processed_rows: 5,
          total_rows: 5,
          summary: {
            validRows: 5,
            invalidRows: 0,
            receiptReadyOrders: 5,
            sentCount: 1,
          },
          error: null,
          created_at: '2026-03-22T10:00:00.000Z',
          committed_at: '2026-06-27T09:58:00.000Z',
          notified_at: '2026-06-27T09:59:00.000Z',
          canCommit: false,
          canNotify: false,
          receiptCampaign: {
            claimedCount: 1,
            clickedCount: 1,
            lastActivityAt: '2026-06-27T10:05:00.000Z',
            loginStartedCount: 1,
            recipients: [
              {
                claimedAt: '2026-06-27T10:05:00.000Z',
                clickCount: 2,
                customerEmail: 'basseybjohn@gmail.com',
                customerName: 'Bassey John',
                firstClickedAt: '2026-06-27T10:00:00.000Z',
                firstLoginStartedAt: '2026-06-27T10:02:00.000Z',
                id: 'claim-1',
                lastClickedAt: '2026-06-27T10:01:00.000Z',
                lastLoginStartedAt: '2026-06-27T10:02:00.000Z',
                loginStartedCount: 1,
                notificationSentAt: '2026-06-27T09:59:00.000Z',
              },
            ],
            sentCount: 1,
            totalRecipients: 1,
          },
        }}
      />
    );

    expect(screen.getByText('Receipt campaign')).toBeInTheDocument();
    expect(screen.getByText('Emails sent')).toBeInTheDocument();
    expect(screen.getByText('Link clicked')).toBeInTheDocument();
    expect(screen.getByText('Login started')).toBeInTheDocument();
    expect(screen.getByText('Receipt claimed')).toBeInTheDocument();
    expect(screen.getByText('Claim rate 100%')).toBeInTheDocument();
    expect(screen.getByText('Bassey John')).toBeInTheDocument();
    expect(screen.getByText('basseybjohn@gmail.com')).toBeInTheDocument();
    expect(screen.getAllByText('Claimed').length).toBeGreaterThan(0);
    expect(screen.getByText('2 clicks')).toBeInTheDocument();
  });
});
