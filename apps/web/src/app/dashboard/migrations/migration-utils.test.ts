import { describe, expect, it } from 'vitest';
import {
  getMigrationProgressDetail,
  getMigrationProgressValue,
  statusBadgeClass,
} from './migration-utils';

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

  it('uses actual row counts for validating progress', () => {
    expect(getMigrationProgressValue('validating', 2911, 5821)).toBe(50);
    expect(getMigrationProgressValue('validating', 5821, 5821)).toBe(99);
    expect(getMigrationProgressDetail('validating', 2911, 5821)).toBe(
      '2,911 of 5,821 rows processed'
    );
  });
});
