import { describe, expect, it } from 'vitest';
import {
  getMigrationEmptyStateCopy,
  getMigrationFilterDescription,
  getMigrationFilterHeading,
  getMigrationSuggestedAction,
} from '@/app/dashboard/migrations/migration-filter-helpers';

describe('migration filter helpers', () => {
  it('returns filter-specific headings and descriptions', () => {
    expect(getMigrationFilterHeading('importable')).toBe(
      'Showing rows ready to import'
    );
    expect(getMigrationFilterDescription('needs_fix')).toContain(
      'correct the CSV'
    );
    expect(getMigrationEmptyStateCopy('all')).toBe(
      'No preview rows available yet.'
    );
  });

  it('returns empty-filter guidance when a selected summary filter has no rows', () => {
    expect(
      getMigrationSuggestedAction({
        activeFilter: 'importable',
        invalidRows: 2,
        validRows: 0,
      })
    ).toEqual({
      description:
        'This preview currently has no rows ready to import. Switch back to all rows or review rows that need fixes.',
      title: 'No rows ready to import',
    });

    expect(
      getMigrationSuggestedAction({
        activeFilter: 'needs_fix',
        invalidRows: 0,
        validRows: 8,
      })
    ).toEqual({
      description:
        'This preview currently has no rows that need fixes. Switch back to all rows to continue reviewing the import.',
      title: 'No fixes needed',
    });
  });
});
