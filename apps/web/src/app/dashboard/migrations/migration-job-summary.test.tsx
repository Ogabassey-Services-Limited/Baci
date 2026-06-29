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
  it('shows receipt campaign empty-recipient guidance', () => {
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
          id: 'job-receipts-empty',
          entity_type: 'orders',
          source_platform: 'bumpa',
          status: 'completed',
          original_filename: 'orders.csv',
          processed_rows: 1,
          total_rows: 1,
          summary: {
            receiptReadyOrders: 1,
            sentCount: 0,
            validRows: 1,
          },
          receiptCampaign: {
            appDownloadClickCount: 0,
            appDownloadClickedCount: 0,
            claimedAppCount: 0,
            claimedCount: 0,
            claimedUnknownCount: 0,
            claimedWebCount: 0,
            clickedAppCount: 0,
            clickedCount: 0,
            clickedUnknownCount: 0,
            clickedWebCount: 0,
            lastActivityAt: null,
            loginStartedAppCount: 0,
            loginStartedCount: 0,
            loginStartedUnknownCount: 0,
            loginStartedWebCount: 0,
            recipients: [],
            sentCount: 0,
            totalRecipients: 0,
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

    expect(
      screen.getByText('No receipt notification recipients yet.')
    ).toBeInTheDocument();
    expect(screen.getByText(/claim rate 0%/i)).toBeInTheDocument();
  });
});
