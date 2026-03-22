import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/csrf', () => ({
  buildCsrfHeaders: vi.fn(() => ({ 'x-csrf-token': 'token' })),
}));

import MigrationsClientPage from '@/app/dashboard/migrations/migrations-client-page';

function createJsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  } as Response;
}

describe('MigrationsClientPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('loads the selected job detail and preview rows on mount', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        createJsonResponse({
          job: {
            id: 'job-1',
            entity_type: 'orders',
            source_platform: 'bumpa',
            status: 'preview_ready',
            original_filename: 'orders.csv',
            processed_rows: 10,
            total_rows: 10,
            summary: { validRows: 8, invalidRows: 2, receiptReadyOrders: 3 },
            error: null,
            created_at: '2026-03-22T10:00:00.000Z',
            committed_at: null,
            notified_at: null,
            canCommit: true,
            canNotify: false,
          },
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          rows: [],
          pagination: { page: 1, pageSize: 25, total: 0 },
        })
      );

    render(
      <MigrationsClientPage
        initialJobs={[
          {
            id: 'job-1',
            entity_type: 'orders',
            source_platform: 'bumpa',
            status: 'uploaded',
            original_filename: 'orders.csv',
            processed_rows: 0,
            total_rows: 0,
            summary: null,
            error: null,
            created_at: '2026-03-22T10:00:00.000Z',
            committed_at: null,
            notified_at: null,
          },
        ]}
      />
    );

    expect(await screen.findByText(/selected job/i)).toBeInTheDocument();
    expect(
      within(screen.getByTestId('valid-rows-summary')).getByText('8')
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith('/api/import-jobs/job-1', {
      cache: 'no-store',
    });
  });

  it('uploads a new CSV and refreshes the selected job', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        createJsonResponse({
          job: {
            id: 'job-2',
            entity_type: 'products',
            source_platform: 'bumpa',
            status: 'uploaded',
            original_filename: 'products.csv',
            processed_rows: 0,
            total_rows: 0,
            summary: null,
            error: null,
            created_at: '2026-03-22T11:00:00.000Z',
            committed_at: null,
            notified_at: null,
          },
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          job: {
            id: 'job-2',
            entity_type: 'products',
            source_platform: 'bumpa',
            status: 'preview_ready',
            original_filename: 'products.csv',
            processed_rows: 5,
            total_rows: 5,
            summary: { validRows: 5, invalidRows: 0, receiptReadyOrders: 0 },
            error: null,
            created_at: '2026-03-22T11:00:00.000Z',
            committed_at: null,
            notified_at: null,
            canCommit: true,
            canNotify: false,
          },
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          rows: [],
          pagination: { page: 1, pageSize: 25, total: 0 },
        })
      );

    render(<MigrationsClientPage initialJobs={[]} />);

    fireEvent.change(screen.getByLabelText(/import type/i), {
      target: { value: 'products' },
    });
    fireEvent.change(screen.getByLabelText(/csv file/i), {
      target: {
        files: [new File(['id\n1'], 'products.csv', { type: 'text/csv' })],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /create preview/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/import-jobs',
        expect.objectContaining({
          method: 'POST',
          headers: { 'x-csrf-token': 'token' },
          body: expect.any(FormData),
        })
      );
    });
    expect(await screen.findByText('products.csv')).toBeInTheDocument();
  });
});
