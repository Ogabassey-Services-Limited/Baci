import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MigrationJobProgressCard from './migration-job-progress-card';

describe('MigrationJobProgressCard', () => {
  it('shows validation progress from CSV row counts', () => {
    render(
      <MigrationJobProgressCard
        processedRows={25}
        status="validating"
        summary={null}
        totalRows={100}
      />
    );

    expect(screen.getByText(/building preview/i)).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText('25 of 100 rows processed')).toBeInTheDocument();
  });

  it('shows notification progress from grouped recipient counts', () => {
    render(
      <MigrationJobProgressCard
        processedRows={800}
        status="notifying"
        summary={{
          notificationProcessedRecipients: 125,
          notificationTotalRecipients: 500,
        }}
        totalRows={800}
      />
    );

    expect(
      screen.getByText(/sending customer notifications/i)
    ).toBeInTheDocument();
    expect(screen.getByText('98%')).toBeInTheDocument();
    expect(
      screen.getByText('125 of 500 customer emails processed')
    ).toBeInTheDocument();
  });

  it('renders nothing for inactive jobs', () => {
    const { container } = render(
      <MigrationJobProgressCard
        processedRows={10}
        status="completed"
        summary={null}
        totalRows={10}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
