import { describe, expectTypeOf, it } from 'vitest';
import type {
  ImportJobDetail,
  ImportJobListItem,
  ImportJobRowsResponse,
} from '@/app/dashboard/migrations/migration-types';

describe('migration-types', () => {
  it('ImportJobListItem has required fields', () => {
    const item: ImportJobListItem = {
      id: 'uuid-1',
      created_at: '2026-03-22T00:00:00Z',
      committed_at: null,
      entity_type: 'orders',
      error: null,
      notified_at: null,
      original_filename: 'orders.csv',
      processed_rows: 100,
      source_platform: 'bumpa',
      status: 'preview_ready',
      summary: null,
      total_rows: 150,
    };
    expectTypeOf(item).toMatchTypeOf<ImportJobListItem>();
  });

  it('ImportJobDetail extends ImportJobListItem with canCommit and canNotify', () => {
    const detail: ImportJobDetail = {
      id: 'uuid-1',
      created_at: '2026-03-22T00:00:00Z',
      committed_at: null,
      entity_type: 'orders',
      error: null,
      notified_at: null,
      original_filename: 'orders.csv',
      processed_rows: 100,
      source_platform: 'bumpa',
      status: 'preview_ready',
      summary: null,
      total_rows: 150,
      canCommit: true,
      canNotify: false,
    };
    expectTypeOf(detail).toMatchTypeOf<ImportJobDetail>();
    expectTypeOf(detail.canCommit).toEqualTypeOf<boolean>();
    expectTypeOf(detail.canNotify).toEqualTypeOf<boolean>();
  });

  it('ImportJobRowsResponse has pagination and rows', () => {
    const response: ImportJobRowsResponse = {
      pagination: { page: 1, pageSize: 25, total: 100 },
      rows: [
        {
          id: 'row-1',
          meta: {},
          normalized_payload: null,
          row_number: 1,
          row_status: 'create',
          source_external_id: '12345',
          validation_errors: [],
        },
      ],
    };
    expectTypeOf(response.pagination.page).toEqualTypeOf<number>();
    expectTypeOf(response.rows[0].row_status).toEqualTypeOf<
      'create' | 'update' | 'duplicate' | 'invalid'
    >();
  });
});
