import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/merchant-server', () => ({
  getMerchantForUser: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('./migrations-client-page', () => ({
  default: ({
    initialError,
    initialJobs,
  }: {
    initialError?: string | null;
    initialJobs: Array<{ id: string }>;
  }) => (
    <div>
      <span>error:{initialError || 'none'}</span>
      <span>jobs:{initialJobs.length}</span>
      {initialJobs.map((job) => (
        <span key={job.id}>{job.id}</span>
      ))}
    </div>
  ),
}));

import { cookies } from 'next/headers';
import { getMerchantForUser } from '@/lib/merchant-server';
import { createClient } from '@/lib/supabase/server';
import MigrationsPage from './page';

function createImportJobsQueryMock(result: {
  data: Record<string, unknown>[] | null;
  error?: Error | null;
}) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockResolvedValue({
    data: result.data,
    error: result.error || null,
  });
  return query;
}

describe('dashboard migrations page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cookies).mockResolvedValue({} as never);
  });

  it('renders an empty migration page when there is no merchant', async () => {
    vi.mocked(getMerchantForUser).mockResolvedValue({
      merchant: null,
    } as never);

    render(await MigrationsPage());

    expect(getMerchantForUser).toHaveBeenCalledTimes(1);
    expect(screen.getByText('jobs:0')).toBeInTheDocument();
    expect(screen.getByText('error:none')).toBeInTheDocument();
  });

  it('loads recent import jobs for the current merchant', async () => {
    const query = createImportJobsQueryMock({
      data: [
        {
          id: 'job-1',
          entity_type: 'orders',
          source_platform: 'bumpa',
          status: 'preview_ready',
          original_filename: 'orders.csv',
          processed_rows: 10,
          total_rows: 10,
          summary: null,
          error: null,
          created_at: '2026-03-22T10:00:00.000Z',
          committed_at: null,
          notified_at: null,
          completed_at: null,
        },
      ],
    });
    vi.mocked(getMerchantForUser).mockResolvedValue({
      merchant: { id: 'merchant-1' },
    } as never);
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn(() => query),
    } as never);

    render(await MigrationsPage());

    expect(getMerchantForUser).toHaveBeenCalledTimes(1);
    expect(screen.getByText('jobs:1')).toBeInTheDocument();
    expect(screen.getByText('job-1')).toBeInTheDocument();
  });

  it('shows a fallback error when loading import jobs fails', async () => {
    const query = createImportJobsQueryMock({
      data: null,
      error: new Error('supabase error'),
    });
    vi.mocked(getMerchantForUser).mockResolvedValue({
      merchant: { id: 'merchant-1' },
    } as never);
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn(() => query),
    } as never);

    render(await MigrationsPage());

    expect(getMerchantForUser).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText('error:Failed to load migration jobs.')
    ).toBeInTheDocument();
    expect(screen.getByText('jobs:0')).toBeInTheDocument();
    expect(screen.queryByText('job-1')).toBeNull();
  });
});
