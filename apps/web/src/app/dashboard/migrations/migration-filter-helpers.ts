import type { MigrationPreviewFilter } from '@/app/dashboard/migrations/migration-types';

interface SuggestedActionInput {
  activeFilter: MigrationPreviewFilter;
  invalidRows: number;
  validRows: number;
}

export function getMigrationEmptyStateCopy(filter: MigrationPreviewFilter) {
  if (filter === 'importable') {
    return 'No rows are currently ready to import.';
  }

  if (filter === 'needs_fix') {
    return 'No rows currently need fixes.';
  }

  return 'No preview rows available yet.';
}

export function getMigrationFilterHeading(filter: MigrationPreviewFilter) {
  if (filter === 'importable') return 'Showing rows ready to import';
  if (filter === 'needs_fix') return 'Showing rows that need fixes';
  return null;
}

export function getMigrationFilterDescription(filter: MigrationPreviewFilter) {
  if (filter === 'importable') {
    return 'These rows will be created or updated when you import this job.';
  }

  if (filter === 'needs_fix') {
    return 'These rows will be skipped until you correct the CSV and create a fresh preview.';
  }

  return null;
}

export function getMigrationSuggestedAction({
  activeFilter,
  invalidRows,
  validRows,
}: SuggestedActionInput) {
  if (activeFilter === 'importable') {
    if (validRows > 0) {
      return {
        description:
          'These rows are ready to import now. Duplicates and invalid rows will stay out of this import.',
        title: 'Ready to import',
      };
    }

    return {
      description:
        'This preview currently has no rows ready to import. Switch back to all rows or review rows that need fixes.',
      title: 'No rows ready to import',
    };
  }

  if (activeFilter === 'needs_fix') {
    if (invalidRows > 0) {
      return {
        description:
          'These rows will be skipped. Review the Errors column, fix the CSV, then create a fresh preview.',
        title: 'Needs attention',
      };
    }

    return {
      description:
        'This preview currently has no rows that need fixes. Switch back to all rows to continue reviewing the import.',
      title: 'No fixes needed',
    };
  }

  if (invalidRows > 0) {
    return {
      description:
        'Use the summary cards to focus on rows that are ready to import or rows that need fixing.',
      title: 'Review before importing',
    };
  }

  return {
    description:
      'Review the preview table, then import the rows that are ready.',
    title: 'Import workflow',
  };
}
