import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/csrf', () => ({
  buildCsrfHeaders: vi.fn(() => ({ 'x-csrf-token': 'token' })),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/app/dashboard/migrations/migration-order-source-chip', () => ({
  default: () => <span>Source chip</span>,
}));

import MigrationsClientPage from '@/app/dashboard/migrations/migrations-client-page';
import { createClient } from '@/lib/supabase/client';

function createJsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  } as Response;
}

function createDeferredResponse() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((innerResolve) => {
    resolve = innerResolve;
  });

  return { promise, resolve };
}

function createMockChannel() {
  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };

  return channel;
}

describe('MigrationsClientPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    const channel = createMockChannel();
    vi.mocked(createClient).mockReturnValue({
      channel: vi.fn().mockReturnValue(channel),
      removeChannel: vi.fn(),
      storage: {
        from: vi.fn(() => ({
          uploadToSignedUrl: vi
            .fn()
            .mockResolvedValue({ data: {}, error: null }),
        })),
      },
    } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('loads the first previewable job detail and preview rows on mount', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      createJsonResponse({
        rows: [],
        pagination: { page: 1, pageSize: 25, total: 0 },
      })
    );

    render(
      <MigrationsClientPage
        initialJobs={[
          {
            id: 'job-stale',
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
          {
            id: 'job-1',
            entity_type: 'orders',
            source_platform: 'bumpa',
            status: 'preview_ready',
            original_filename: 'orders.csv',
            processed_rows: 10,
            total_rows: 10,
            summary: { validRows: 8, invalidRows: 2, receiptReadyOrders: 3 },
            error: null,
            created_at: '2026-03-22T11:00:00.000Z',
            committed_at: null,
            notified_at: null,
          },
        ]}
      />
    );

    expect(
      screen.getByRole('heading', { name: /choose a source to continue/i })
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /bumpa/i }));

    expect(await screen.findByText(/selected job/i)).toBeInTheDocument();
    expect(
      screen.getByRole('status', { name: /^valid rows$/i })
    ).toHaveTextContent('8');
    expect(fetch).toHaveBeenCalledWith(
      '/api/import-jobs/job-1/rows?filter=all&page=1&pageSize=25',
      {
        cache: 'no-store',
      }
    );
    expect(fetch).not.toHaveBeenCalledWith('/api/import-jobs/job-1', {
      cache: 'no-store',
    });
  });

  it('switches between source platforms without reworking the existing Bumpa flow', async () => {
    const user = userEvent.setup();

    render(<MigrationsClientPage initialJobs={[]} />);

    expect(
      screen.getByRole('heading', { name: /commerce migrations/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /choose a source to continue/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/upload csv/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /shopify/i }));

    expect(await screen.findByText(/shopify migration/i)).toBeInTheDocument();
    expect(screen.getByText(/connect store/i)).toBeInTheDocument();
    expect(screen.queryByText(/upload csv/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /bumpa/i }));

    expect(screen.getByText(/upload csv/i)).toBeInTheDocument();
  });

  it('does not auto-select stale queued jobs when no previewable job exists', async () => {
    render(
      <MigrationsClientPage
        initialJobs={[
          {
            id: 'job-queued',
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

    expect(fetch).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /bumpa/i }));

    expect(
      await screen.findByText(/select a job to inspect its preview rows/i)
    ).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uploads a new CSV and refreshes the selected job', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        createJsonResponse({
          upload: {
            clientUploadId: 'client-upload-1',
            storagePath: 'merchant-1/products/upload.csv',
            uploadToken: 'upload-token',
          },
        })
      )
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

    fireEvent.click(screen.getByRole('button', { name: /bumpa/i }));

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
      expect(fetch).toHaveBeenNthCalledWith(
        1,
        '/api/import-jobs/upload-init',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'content-type': 'application/json',
            'x-csrf-token': 'token',
          }),
        })
      );
      const uploadInitRequest = vi.mocked(fetch).mock.calls[0]?.[1];
      expect(JSON.parse(String(uploadInitRequest?.body))).toEqual({
        sourcePlatform: 'bumpa',
        entityType: 'products',
        fileName: 'products.csv',
        fileSizeBytes: 4,
        contentType: 'text/csv',
      });
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        '/api/import-jobs/finalize',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'content-type': 'application/json',
            'x-csrf-token': 'token',
          }),
        })
      );
    });
    expect(await screen.findByText('products.csv')).toBeInTheDocument();
  });

  it('keeps the current UI state when a background job refresh fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ error: 'Failed to load import job' }),
    } as Response);

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

    fireEvent.click(screen.getByRole('button', { name: /bumpa/i }));

    fireEvent.click(screen.getByRole('button', { name: /orders\.csv/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/import-jobs/job-1', {
        cache: 'no-store',
      });
    });

    expect(
      screen.queryByText(/failed to load import job/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/no validation errors/i)).not.toBeInTheDocument();
  });

  it('shows processing copy without loading preview rows while validation is running', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        createJsonResponse({
          upload: {
            clientUploadId: 'client-upload-1',
            storagePath: 'merchant-1/orders/upload.csv',
            uploadToken: 'upload-token',
          },
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          job: {
            id: 'job-3',
            entity_type: 'orders',
            source_platform: 'bumpa',
            status: 'uploaded',
            original_filename: 'orders.csv',
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
            id: 'job-3',
            entity_type: 'orders',
            source_platform: 'bumpa',
            status: 'validating',
            original_filename: 'orders.csv',
            processed_rows: 0,
            total_rows: 5821,
            summary: { validRows: 0, invalidRows: 0, receiptReadyOrders: 0 },
            error: null,
            created_at: '2026-03-22T11:00:00.000Z',
            committed_at: null,
            notified_at: null,
            canCommit: false,
            canNotify: false,
          },
        })
      );

    render(<MigrationsClientPage initialJobs={[]} />);

    await userEvent.click(screen.getByRole('button', { name: /bumpa/i }));

    fireEvent.change(screen.getByLabelText(/csv file/i), {
      target: {
        files: [new File(['id\n1'], 'orders.csv', { type: 'text/csv' })],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /create preview/i }));

    expect(await screen.findByText(/building preview/i)).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(
      screen.getByText(/no preview rows available yet/i)
    ).toBeInTheDocument();
  });

  it('refetches preview rows with the selected summary filter', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      createJsonResponse({
        rows: [
          {
            id: 'row-1',
            meta: {},
            normalized_payload: null,
            row_number: 2,
            row_status: 'invalid',
            source_external_id: null,
            source_payload: {},
            validation_errors: ['Missing order number'],
          },
        ],
        pagination: { page: 1, pageSize: 25, total: 1 },
      })
    );

    render(
      <MigrationsClientPage
        initialJobs={[
          {
            id: 'job-1',
            entity_type: 'orders',
            source_platform: 'bumpa',
            status: 'preview_ready',
            original_filename: 'orders.csv',
            processed_rows: 10,
            total_rows: 10,
            summary: { validRows: 8, invalidRows: 2, receiptReadyOrders: 3 },
            error: null,
            created_at: '2026-03-22T11:00:00.000Z',
            committed_at: null,
            notified_at: null,
          },
        ]}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /bumpa/i }));

    await screen.findByText(/selected job/i);
    vi.mocked(fetch).mockClear();
    vi.mocked(fetch).mockResolvedValueOnce(
      createJsonResponse({
        rows: [
          {
            id: 'row-2',
            meta: {},
            normalized_payload: null,
            row_number: 4,
            row_status: 'invalid',
            source_external_id: null,
            source_payload: {},
            validation_errors: ['Missing order number'],
          },
        ],
        pagination: { page: 1, pageSize: 25, total: 1 },
      })
    );

    fireEvent.click(screen.getByRole('button', { name: /needs fix/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/import-jobs/job-1/rows?filter=needs_fix&page=1&pageSize=25',
        { cache: 'no-store' }
      );
    });
    expect(
      await screen.findByText(/showing rows that need fixes/i)
    ).toBeInTheDocument();
    expect(screen.getAllByText('CSV Row 4')).toHaveLength(2);
    expect(screen.getByText('Missing order number')).toBeInTheDocument();
  });

  it('does not overlap validating poll requests while a refresh is in flight', async () => {
    vi.useFakeTimers();
    const deferredRefresh = createDeferredResponse();

    vi.mocked(fetch)
      .mockResolvedValueOnce(
        createJsonResponse({
          job: {
            id: 'job-1',
            entity_type: 'orders',
            source_platform: 'bumpa',
            status: 'validating',
            original_filename: 'orders.csv',
            processed_rows: 1,
            total_rows: 10,
            summary: { validRows: 0, invalidRows: 0, receiptReadyOrders: 0 },
            error: null,
            created_at: '2026-03-22T10:00:00.000Z',
            committed_at: null,
            notified_at: null,
            canCommit: false,
            canNotify: false,
          },
        })
      )
      .mockReturnValueOnce(deferredRefresh.promise);

    const { unmount } = render(
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

    fireEvent.click(screen.getByRole('button', { name: /bumpa/i }));

    fireEvent.click(screen.getByRole('button', { name: /orders\.csv/i }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText(/building preview/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(fetch).toHaveBeenCalledTimes(2);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(fetch).toHaveBeenCalledTimes(2);

    await act(async () => {
      deferredRefresh.resolve(
        createJsonResponse({
          rows: [],
          pagination: { page: 1, pageSize: 25, total: 0 },
        })
      );
      await Promise.resolve();
    });

    unmount();
  });
});
