import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AgenticRecentSignedRequestsCard } from './agentic-recent-signed-requests-card';

describe('AgenticRecentSignedRequestsCard', () => {
  it('renders an empty recent request count without a list', () => {
    render(
      <AgenticRecentSignedRequestsCard
        recentRequestCount={0}
        recentRequestRecords={[]}
      />
    );

    expect(screen.getByText('Recent signed requests')).toBeInTheDocument();
    expect(screen.getByText('0 recent requests')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('renders a singular recent request count', () => {
    render(
      <AgenticRecentSignedRequestsCard
        recentRequestCount={1}
        recentRequestRecords={[
          {
            api_version: '2026-04-30',
            created_at: '2026-05-12T22:40:00.000Z',
            expires_at: '2026-05-12T22:50:00.000Z',
          },
        ]}
      />
    );

    expect(screen.getByText('1 recent request')).toBeInTheDocument();
  });

  it('renders duplicate signed request records without dropping rows', () => {
    render(
      <AgenticRecentSignedRequestsCard
        recentRequestCount={2}
        recentRequestRecords={[
          {
            api_version: '2026-04-30',
            created_at: '2026-05-12T22:40:00.000Z',
            expires_at: '2026-05-12T22:50:00.000Z',
          },
          {
            api_version: '2026-04-30',
            created_at: '2026-05-12T22:40:00.000Z',
            expires_at: '2026-05-12T22:50:00.000Z',
          },
        ]}
      />
    );

    expect(screen.getAllByText('API 2026-04-30')).toHaveLength(2);
  });

  it('renders recent signed request count and API labels', () => {
    render(
      <AgenticRecentSignedRequestsCard
        recentRequestCount={2}
        recentRequestRecords={[
          {
            api_version: '2026-04-30',
            created_at: '2026-05-12T22:40:00.000Z',
            expires_at: '2026-05-12T22:50:00.000Z',
          },
          {
            api_version: null,
            created_at: '2026-05-12T22:40:00.000Z',
            expires_at: '2026-05-12T22:50:00.000Z',
          },
        ]}
      />
    );

    expect(screen.getByText('Recent signed requests')).toBeInTheDocument();
    expect(screen.getByText('2 recent requests')).toBeInTheDocument();
    expect(screen.getByText('API 2026-04-30')).toBeInTheDocument();
    expect(screen.getByText('API unknown')).toBeInTheDocument();
  });
});
