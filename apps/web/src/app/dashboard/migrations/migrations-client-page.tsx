'use client';

import MigrationJobSummary from '@/app/dashboard/migrations/migration-job-summary';
import MigrationPreviewTable from '@/app/dashboard/migrations/migration-preview-table';
import MigrationSidebar from '@/app/dashboard/migrations/migration-sidebar';
import type { ImportJobListItem } from '@/app/dashboard/migrations/migration-types';
import { useMigrationJobs } from '@/app/dashboard/migrations/use-migration-jobs';

export default function MigrationsClientPage({
  initialError,
  initialJobs,
}: {
  initialError?: string | null;
  initialJobs: ImportJobListItem[];
}) {
  const {
    activeFilter,
    acting,
    entityType,
    error,
    handleFilterChange,
    handleUpload,
    jobs,
    loading,
    queueJobAction,
    refreshJob,
    rowsLoading,
    rowsResponse,
    selectedJob,
    selectedJobId,
    setEntityType,
    setFile,
    setSelectedJobId,
    uploading,
  } = useMigrationJobs({
    initialError,
    initialJobs,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Bumpa Migrations
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Upload Bumpa CSV exports, review a normalized preview, import the
          data, and optionally notify customers once historical orders are live.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <MigrationSidebar
          entityType={entityType}
          jobs={jobs}
          onEntityTypeChange={setEntityType}
          onFileChange={setFile}
          onJobSelect={setSelectedJobId}
          onUpload={handleUpload}
          selectedJobId={selectedJobId}
          uploading={uploading}
        />

        <div className="space-y-6">
          <MigrationJobSummary
            activeFilter={activeFilter}
            acting={acting}
            error={error}
            loading={loading}
            onFilterChange={handleFilterChange}
            onCommit={() =>
              queueJobAction(`/api/import-jobs/${selectedJobId}/commit`)
            }
            onNotify={() =>
              queueJobAction(
                `/api/import-jobs/${selectedJobId}/notify-customers`
              )
            }
            onRefresh={async () => {
              if (!selectedJobId) {
                return;
              }

              await refreshJob(selectedJobId, {
                filter: activeFilter,
                page: rowsResponse?.pagination.page || 1,
              });
            }}
            selectedJob={selectedJob}
          />

          <MigrationPreviewTable
            entityType={selectedJob?.entity_type || entityType}
            filter={activeFilter}
            loading={rowsLoading}
            onPageChange={(page) =>
              selectedJobId &&
              void refreshJob(selectedJobId, {
                filter: activeFilter,
                includeJob: false,
                includeRows: true,
                page,
              })
            }
            page={rowsResponse?.pagination.page || 1}
            pageSize={rowsResponse?.pagination.pageSize || 25}
            rows={rowsResponse?.rows || []}
            total={rowsResponse?.pagination.total || 0}
          />
        </div>
      </div>
    </div>
  );
}
