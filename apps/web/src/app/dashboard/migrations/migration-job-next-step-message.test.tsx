import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ImportJobDetail } from '@/app/dashboard/migrations/migration-types';
import MigrationJobNextStepMessage from './migration-job-next-step-message';

function createJob(overrides: Partial<ImportJobDetail> = {}): ImportJobDetail {
  return {
    canCommit: false,
    canNotify: true,
    committed_at: '2026-03-22T10:05:00.000Z',
    created_at: '2026-03-22T10:00:00.000Z',
    entity_type: 'orders',
    error: null,
    id: 'job-1',
    notified_at: null,
    original_filename: 'orders.csv',
    processed_rows: 10,
    source_platform: 'bumpa',
    status: 'committed',
    summary: { validRows: 10 },
    total_rows: 10,
    ...overrides,
  };
}

describe('MigrationJobNextStepMessage', () => {
  it('tells merchants to notify customers after a committed order import', () => {
    render(<MigrationJobNextStepMessage job={createJob()} />);

    expect(screen.getByText('Import complete')).toBeInTheDocument();
    expect(screen.getByText(/click/i, { exact: false })).toHaveTextContent(
      /notify customers/i
    );
  });

  it('shows generic success copy for non-notifiable imports', () => {
    render(
      <MigrationJobNextStepMessage
        job={createJob({ canNotify: false, entity_type: 'products' })}
      />
    );

    expect(screen.getByText('Import complete')).toBeInTheDocument();
    expect(
      screen.getByText(/imported records are now available/i)
    ).toBeInTheDocument();
  });

  it('renders nothing before commit is complete', () => {
    const { container } = render(
      <MigrationJobNextStepMessage
        job={createJob({ canNotify: false, status: 'preview_ready' })}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
