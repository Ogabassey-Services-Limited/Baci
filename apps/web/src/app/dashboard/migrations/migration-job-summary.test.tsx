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
        acting={false}
        error={null}
        loading={false}
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

    fireEvent.click(screen.getByRole('button', { name: /commit import/i }));
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
        acting={false}
        error="Something failed"
        loading={false}
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
});
