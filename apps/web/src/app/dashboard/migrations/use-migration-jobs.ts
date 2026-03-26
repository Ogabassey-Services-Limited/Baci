'use client';

import { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  createImportJob,
  fetchImportJob,
  fetchImportJobRows,
  mergeJobs,
  postImportJobAction,
} from '@/app/dashboard/migrations/migration-job-api';
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
import { useMigrationJobPolling } from '@/app/dashboard/migrations/use-migration-job-polling';
export function useMigrationJobs({
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
    const initialSelectedJob =
      initialJobs.find((job) => job.id === initialSelectedJobId) || null;
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
          nextJob = await fetchImportJob(jobId);
          if (requestId !== refreshRequestIdRef.current) {
            return false;
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
          return true;
        }

        if (includeRows) {
          const rowsPayload = await fetchImportJobRows(jobId, page, filter);
          if (requestId !== refreshRequestIdRef.current) {
            return false;
          }
          setRowsResponse(rowsPayload);
        }
        return true;
      } catch (jobError) {
        if (requestId !== refreshRequestIdRef.current) {
          return false;
        }

        setError(
          jobError instanceof Error
            ? jobError.message
            : 'Failed to load import job'
        );
        return false;
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

  useMigrationJobPolling({
    activeFilter,
    refreshJob,
    rowsResponse,
    selectedJob,
    selectedJobId,
  });
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
      const nextJob = await createImportJob(formData);
      setJobs((currentJobs) => mergeJobs(currentJobs, nextJob));
      setSelectedJobId(nextJob.id);
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
      await postImportJobAction(path);

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

  async function handleFilterChange(filter: MigrationPreviewFilter) {
    if (!selectedJobId || !selectedJob) {
      return;
    }

    if (!shouldFetchMigrationRows(selectedJob.status)) {
      return;
    }

    const previousRowsResponse = rowsResponse;
    setRowsResponse(null);

    const didRefresh = await refreshJob(selectedJobId, {
      filter,
      includeJob: false,
      includeRows: true,
      page: 1,
    });

    if (didRefresh) {
      setActiveFilter(filter);
      return;
    }

    setRowsResponse(previousRowsResponse);
  }

  return {
    activeFilter,
    acting,
    entityType,
    error,
    file,
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
  };
}
