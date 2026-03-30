import { describe, expect, it } from 'vitest';
import {
  canLoadMigrationRows,
  decorateImportJob,
  filterMigrationRows,
  getMigrationProgressDetail,
  getMigrationProgressValue,
  getMigrationRowsCacheKey,
  statusBadgeClass,
} from '@/app/dashboard/migrations/migration-utils';

describe('statusBadgeClass', () => {
  it.each(['completed', 'committed'])('returns green for %s', (status) => {
    expect(statusBadgeClass(status)).toBe('bg-emerald-500/10 text-emerald-700');
  });

  it('returns red for failed', () => {
    expect(statusBadgeClass('failed')).toBe('bg-rose-500/10 text-rose-700');
  });

  it.each([
    'uploaded',
    'validating',
    'commit_queued',
    'committing',
    'notify_queued',
    'notifying',
  ])('returns blue for in-progress status %s', (status) => {
    expect(statusBadgeClass(status)).toBe('bg-blue-500/10 text-blue-700');
  });

  it('returns muted for unknown status', () => {
    expect(statusBadgeClass('something_else')).toBe(
      'bg-muted text-muted-foreground'
    );
  });
});

describe('migration progress utils', () => {
  it('uses actual row counts for validating progress', () => {
    expect(getMigrationProgressValue('validating', 2911, 5821)).toBe(50);
    expect(getMigrationProgressValue('validating', 5821, 5821)).toBe(99);
    expect(getMigrationProgressDetail('validating', 2911, 5821)).toBe(
      '2,911 of 5,821 rows processed'
    );
  });

  it('returns null (indeterminate) when validating with no total rows', () => {
    expect(getMigrationProgressValue('validating', 0, 0)).toBeNull();
    expect(getMigrationProgressDetail('validating', 0, 0)).toBe(
      'Loading and parsing file...'
    );
  });

  it('returns zero percent when nothing has been processed yet', () => {
    expect(getMigrationProgressValue('validating', 0, 5821)).toBe(0);
    expect(getMigrationProgressDetail('validating', 0, 5821)).toBe(
      '0 of 5,821 rows processed'
    );
  });

  it('clamps invalid negative progress inputs safely', () => {
    expect(getMigrationProgressValue('validating', -5, 10)).toBe(0);
    expect(getMigrationProgressDetail('validating', -5, 10)).toBe(
      '0 of 10 rows processed'
    );
  });
});

describe('decorateImportJob', () => {
  const baseJob = {
    committed_at: null,
    created_at: '2026-03-22T10:00:00.000Z',
    entity_type: 'orders' as const,
    error: null,
    id: 'job-1',
    notified_at: null,
    original_filename: 'orders.csv',
    processed_rows: 10,
    source_platform: 'bumpa' as const,
    status: 'preview_ready' as const,
    summary: null,
    total_rows: 10,
  };

  it('allows commit only when preview is ready with positive valid rows', () => {
    expect(
      decorateImportJob({
        ...baseJob,
        summary: { validRows: 3 },
      }).canCommit
    ).toBe(true);

    expect(
      decorateImportJob({
        ...baseJob,
        summary: { validRows: 0 },
      }).canCommit
    ).toBe(false);
  });

  it('handles missing or non-numeric valid rows safely', () => {
    expect(
      decorateImportJob({
        ...baseJob,
        summary: {},
      }).canCommit
    ).toBe(false);

    expect(
      decorateImportJob({
        ...baseJob,
        summary: { validRows: '3' },
      }).canCommit
    ).toBe(false);
  });

  it('allows notify only for committed orders with valid rows', () => {
    expect(
      decorateImportJob({
        ...baseJob,
        status: 'committed',
        summary: { validRows: 2 },
      }).canNotify
    ).toBe(true);

    expect(
      decorateImportJob({
        ...baseJob,
        entity_type: 'products',
        status: 'committed',
        summary: { validRows: 2 },
      }).canNotify
    ).toBe(false);
  });
});

describe('filterMigrationRows', () => {
  const rows = [
    { id: 'row-1', row_status: 'create', importable: true },
    { id: 'row-2', row_status: 'update', importable: true },
    { id: 'row-3', row_status: 'duplicate', importable: false },
    { id: 'row-4', row_status: 'invalid', importable: false },
  ] as const;

  it('returns only importable create and update rows for the importable filter', () => {
    expect(filterMigrationRows([...rows], 'importable')).toEqual([
      rows[0],
      rows[1],
    ]);
  });

  it('returns only invalid rows for the needs_fix filter', () => {
    expect(filterMigrationRows([...rows], 'needs_fix')).toEqual([rows[3]]);
  });

  it('returns all rows for the default filter and handles empty arrays', () => {
    expect(filterMigrationRows([...rows], 'all')).toEqual([...rows]);
    expect(filterMigrationRows([], 'needs_fix')).toEqual([]);
  });
});

describe('migration row loading helpers', () => {
  it('allows persisted validating rows to load before preview_ready', () => {
    expect(canLoadMigrationRows('validating', 0)).toBe(false);
    expect(canLoadMigrationRows('validating', 1)).toBe(true);
    expect(canLoadMigrationRows('preview_ready', 0)).toBe(true);
  });

  it('creates stable cache keys for job, filter, and page', () => {
    expect(getMigrationRowsCacheKey('job-1', 'all', 1)).toBe('job-1:all:1');
    expect(getMigrationRowsCacheKey('job-1', 'needs_fix', 2)).toBe(
      'job-1:needs_fix:2'
    );
  });
});
