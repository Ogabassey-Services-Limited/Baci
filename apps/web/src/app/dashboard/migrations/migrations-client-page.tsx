'use client';

import { useState } from 'react';
import MigrationJobSummary from '@/app/dashboard/migrations/migration-job-summary';
import MigrationPreviewTable from '@/app/dashboard/migrations/migration-preview-table';
import MigrationShopifyPlaceholder from '@/app/dashboard/migrations/migration-shopify-placeholder';
import MigrationSidebar from '@/app/dashboard/migrations/migration-sidebar';
import MigrationSourceSelector, {
  type MigrationSourcePlatform,
} from '@/app/dashboard/migrations/migration-source-selector';
import type { ImportJobListItem } from '@/app/dashboard/migrations/migration-types';
import { useMigrationJobs } from '@/app/dashboard/migrations/use-migration-jobs';
import { Card, CardContent } from '@/components/ui/card';

interface MigrationWorkflowProps {
  initialError?: string | null;
  initialJobs: ImportJobListItem[];
}

function BumpaMigrationWorkflow({
  initialError,
  initialJobs,
}: MigrationWorkflowProps) {
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
            queueJobAction(`/api/import-jobs/${selectedJobId}/notify-customers`)
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
  );
}

export default function MigrationsClientPage({
  initialError,
  initialJobs,
}: MigrationWorkflowProps) {
  const [sourcePlatform, setSourcePlatform] =
    useState<MigrationSourcePlatform | null>(null);
  const [bumpaEverSelected, setBumpaEverSelected] = useState(false);

  const bumpaVisited = sourcePlatform === 'bumpa' || bumpaEverSelected;

  const handleSourceChange = (next: MigrationSourcePlatform) => {
    setSourcePlatform(next);
    if (next === 'bumpa') {
      setBumpaEverSelected(true);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Commerce Migrations
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Choose the platform you are migrating from, then preview and import
          historical data into Baci with the right workflow.
        </p>
      </div>

      <MigrationSourceSelector
        onValueChange={handleSourceChange}
        value={sourcePlatform}
      />

      {sourcePlatform === null && (
        <Card className="border-dashed border-border/70 bg-background/70">
          <CardContent className="flex flex-col gap-2 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary/80">
              Start here
            </p>
            <h2 className="text-xl font-semibold tracking-tight">
              Choose a source to continue
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Select the platform you are migrating from. Bumpa is ready for CSV
              imports now, and Shopify will open its own guided connection flow
              when it is available.
            </p>
          </CardContent>
        </Card>
      )}

      {bumpaVisited && (
        <div className={sourcePlatform !== 'bumpa' ? 'hidden' : undefined}>
          <BumpaMigrationWorkflow
            initialError={initialError}
            initialJobs={initialJobs}
          />
        </div>
      )}

      {sourcePlatform === 'shopify' && <MigrationShopifyPlaceholder />}
    </div>
  );
}
