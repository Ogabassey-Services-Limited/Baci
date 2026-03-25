'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import MigrationJobSummary from '@/app/dashboard/migrations/migration-job-summary';
import MigrationPreviewTable from '@/app/dashboard/migrations/migration-preview-table';
import MigrationSidebar from '@/app/dashboard/migrations/migration-sidebar';
import type {
  ImportJobDetail,
  ImportJobListItem,
  ImportJobRowsResponse,
  MigrationPreviewFilter,
} from '@/app/dashboard/migrations/migration-types';
import {
  decorateImportJob,
  getInitialMigrationSelection,
  isMigrationStatusActive,
  shouldFetchMigrationRows,
} from '@/app/dashboard/migrations/migration-utils';
import { buildCsrfHeaders } from '@/lib/csrf';

function mergeJobs(jobs: ImportJobListItem[], nextJob: ImportJobListItem) {
  return [nextJob, ...jobs.filter((job) => job.id !== nextJob.id)];
}

function buildRowsUrl(
  jobId: string,
  page: number,
  filter: MigrationPreviewFilter
) {
  const params = new URLSearchParams({
    filter,
    page: String(page),
    pageSize: '25',
  });

  return `/api/import-jobs/${jobId}/rows?${params.toString()}`;
}

export default function MigrationsClientPage({
  initialError,
  initialJobs,
}: {
  initialError?: string | null;
  initialJobs: ImportJobListItem[];
}) {
  const initialSelectedJobId = getInitialMigrationSelection(initialJobs);
  const [entityType, setEntityType] = useState<'orders' | 'products'>('orders');
  const [file, setFile] = useState<File | null>(null);
  const [jobs, setJobs] = useState(initialJobs);
  const [selectedJobId, setSelectedJobId] = useState(initialSelectedJobId);
  const [selectedJob, setSelectedJob] = useState<ImportJobDetail | null>(() => {
    const initialSelectedJob = initialSelectedJobId
      ? initialJobs.find((job) => job.id === initialSelectedJobId)
      : null;

    return initialSelectedJob ? decorateImportJob(initialSelectedJob) : null;
  });
  const [rowsResponse, setRowsResponse] =
    useState<ImportJobRowsResponse | null>(null);
  const [activeFilter, setActiveFilter] =
    useState<MigrationPreviewFilter>('all');
  const [loading, setLoading] = useState(false);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const jobsRef = useRef(jobs);
  const refreshRequestIdRef = useRef(0);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  const refreshJob = useEffectEvent(
    async (
      jobId: string,
      options?: {
        background?: boolean;
        filter?: MigrationPreviewFilter;
        includeJob?: boolean;
        includeRows?: boolean;
        page?: number;
      }
    ) => {
      const page = options?.page || 1;
      const background = options?.background ?? false;
      const includeJob = options?.includeJob ?? true;
      const includeRows = options?.includeRows ?? true;
      const filter = options?.filter ?? activeFilter;
      const requestId = ++refreshRequestIdRef.current;

      if (!background && includeJob) {
        setLoading(true);
      }
      if (!background && includeRows) {
        setRowsLoading(true);
      }
      if (!background) {
        setError(null);
      }

      try {
        let nextJob = selectedJobId === jobId ? selectedJob : null;

        if (includeJob) {
          const jobResponse = await fetch(`/api/import-jobs/${jobId}`, {
            cache: 'no-store',
          });
          const jobPayload = await jobResponse.json();

          if (!jobResponse.ok) {
            throw new Error(jobPayload.error || 'Failed to load import job');
          }

          nextJob = jobPayload.job as ImportJobDetail;

          if (requestId !== refreshRequestIdRef.current) {
            return;
          }

          setSelectedJob(nextJob);
          setJobs((currentJobs) =>
            mergeJobs(currentJobs, nextJob as ImportJobListItem)
          );
        }

        if (!nextJob || !shouldFetchMigrationRows(nextJob.status)) {
          if (requestId === refreshRequestIdRef.current) {
            setRowsResponse(null);
          }
          return;
        }

        if (includeRows) {
          const rowsResponseData = await fetch(
            buildRowsUrl(jobId, page, filter),
            {
              cache: 'no-store',
            }
          );
          const rowsPayload = (await rowsResponseData.json()) as
            | ImportJobRowsResponse
            | { error?: string };

          if (!rowsResponseData.ok) {
            throw new Error(
              ('error' in rowsPayload && rowsPayload.error) ||
                'Failed to load import job rows'
            );
          }

          if (requestId !== refreshRequestIdRef.current) {
            return;
          }

          setRowsResponse(rowsPayload as ImportJobRowsResponse);
        }
      } catch (jobError) {
        if (requestId !== refreshRequestIdRef.current) {
          return;
        }

        setError(
          jobError instanceof Error
            ? jobError.message
            : 'Failed to load import job'
        );
      } finally {
        if (
          !background &&
          includeJob &&
          requestId === refreshRequestIdRef.current
        ) {
          setLoading(false);
        }
        if (
          !background &&
          includeRows &&
          requestId === refreshRequestIdRef.current
        ) {
          setRowsLoading(false);
        }
      }
    }
  );

  useEffect(() => {
    if (!selectedJobId) {
      setSelectedJob(null);
      setRowsResponse(null);
      return;
    }

    setActiveFilter('all');
    setRowsResponse(null);

    const nextSelectedJob =
      jobsRef.current.find((job) => job.id === selectedJobId) || null;
    if (nextSelectedJob) {
      const decoratedJob = decorateImportJob(nextSelectedJob);
      setSelectedJob(decoratedJob);

      if (isMigrationStatusActive(decoratedJob.status)) {
        void refreshJob(selectedJobId, {
          background: true,
          filter: 'all',
          includeJob: true,
          includeRows: true,
        });
      } else if (shouldFetchMigrationRows(decoratedJob.status)) {
        void refreshJob(selectedJobId, {
          filter: 'all',
          includeJob: false,
          includeRows: true,
        });
      }
      return;
    }

    setSelectedJob(null);
    void refreshJob(selectedJobId, { filter: 'all' });
  }, [selectedJobId]);

  useEffect(() => {
    if (!selectedJobId) {
      return;
    }

    const nextSelectedJob = jobs.find((job) => job.id === selectedJobId);
    if (nextSelectedJob) {
      setSelectedJob(decorateImportJob(nextSelectedJob));
    }
  }, [jobs, selectedJobId]);

  useEffect(() => {
    if (
      !selectedJobId ||
      !selectedJob ||
      !isMigrationStatusActive(selectedJob.status)
    ) {
      return;
    }

    const intervalId = window.setInterval(
      () => {
        void refreshJob(selectedJobId, {
          background: true,
          filter: activeFilter,
          page: rowsResponse?.pagination.page || 1,
        });
      },
      selectedJob.status === 'validating' ? 1000 : 2500
    );

    return () => window.clearInterval(intervalId);
  }, [activeFilter, rowsResponse?.pagination.page, selectedJob, selectedJobId]);

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError('Choose a CSV file to start the migration preview.');
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.set('sourcePlatform', 'bumpa');
    formData.set('entityType', entityType);
    formData.set('file', file);

    try {
      const response = await fetch('/api/import-jobs', {
        method: 'POST',
        headers: buildCsrfHeaders(),
        body: formData,
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to create import job');
      }

      setJobs((currentJobs) =>
        mergeJobs(currentJobs, payload.job as ImportJobListItem)
      );
      setSelectedJobId(payload.job.id as string);
      setFile(null);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : 'Upload failed'
      );
    } finally {
      setUploading(false);
    }
  }

  async function queueJobAction(path: string) {
    if (!selectedJobId) {
      return;
    }

    setActing(true);
    setError(null);

    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: buildCsrfHeaders(),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to queue job action');
      }

      await refreshJob(selectedJobId, {
        filter: activeFilter,
        page: rowsResponse?.pagination.page || 1,
      });
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : 'Action failed'
      );
    } finally {
      setActing(false);
    }
  }

  function handleFilterChange(filter: MigrationPreviewFilter) {
    setActiveFilter(filter);

    if (!selectedJobId || !selectedJob) {
      return;
    }

    if (!shouldFetchMigrationRows(selectedJob.status)) {
      return;
    }

    void refreshJob(selectedJobId, {
      filter,
      includeJob: false,
      includeRows: true,
      page: 1,
    });
  }

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
            onRefresh={() =>
              selectedJobId
                ? refreshJob(selectedJobId, {
                    filter: activeFilter,
                    page: rowsResponse?.pagination.page || 1,
                  })
                : Promise.resolve()
            }
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
