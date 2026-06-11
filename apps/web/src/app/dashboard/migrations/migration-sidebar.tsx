'use client';

import { FileUp, Loader2, UploadCloud } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { statusBadgeClass } from '@/app/dashboard/migrations/migration-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { ImportUploadProgress } from './migration-job-api';
import type { ImportJobListItem } from './migration-types';

interface MigrationSidebarProps {
  entityType: 'orders' | 'products';
  jobs: ImportJobListItem[];
  onEntityTypeChange: (value: 'orders' | 'products') => void;
  onFileChange: (file: File | null) => void;
  onJobSelect: (jobId: string) => void;
  onUpload: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  selectedJobId: string | null;
  selectedFileName: string | null;
  uploadProgress: ImportUploadProgress | null;
  uploading: boolean;
}

export default function MigrationSidebar({
  entityType,
  jobs,
  onEntityTypeChange,
  onFileChange,
  onJobSelect,
  onUpload,
  selectedJobId,
  selectedFileName,
  uploadProgress,
  uploading,
}: MigrationSidebarProps) {
  const csvFileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasSelectedFile = Boolean(selectedFileName);

  useEffect(() => {
    if (!selectedFileName && fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [selectedFileName]);

  const uploadProgressLabel =
    uploadProgress?.stage === 'finalizing'
      ? 'Finalizing upload'
      : uploadProgress?.stage === 'uploading'
        ? 'Uploading CSV'
        : 'Preparing upload';

  const uploadProgressDetail = uploadProgress
    ? `${Math.min(
        uploadProgress.bytesUploaded,
        uploadProgress.bytesTotal
      ).toLocaleString()} of ${uploadProgress.bytesTotal.toLocaleString()} bytes`
    : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadCloud className="h-5 w-5" />
            Upload CSV
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              if (uploading || !hasSelectedFile) {
                event.preventDefault();
                return;
              }

              void onUpload(event);
            }}
          >
            <label className="block text-sm font-medium">
              Import type
              <select
                className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm"
                onChange={(event) =>
                  onEntityTypeChange(
                    event.target.value as 'orders' | 'products'
                  )
                }
                value={entityType}
              >
                <option value="orders">Orders CSV</option>
                <option value="products">Products CSV</option>
              </select>
            </label>

            <div className="space-y-2">
              <label
                className="block text-sm font-medium"
                htmlFor={csvFileInputId}
              >
                CSV file
              </label>
              <input
                accept=".csv,text/csv"
                className="sr-only"
                id={csvFileInputId}
                name="csvFile"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] || null;
                  onFileChange(nextFile);
                }}
                ref={fileInputRef}
                tabIndex={-1}
                type="file"
              />
              {hasSelectedFile && (
                <div className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Selected:
                    </span>{' '}
                    {selectedFileName}
                  </span>
                  <Button
                    className="shrink-0"
                    onClick={() => fileInputRef.current?.click()}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Change
                  </Button>
                </div>
              )}
            </div>

            {hasSelectedFile ? (
              <Button
                className="w-full"
                disabled={uploading}
                size="lg"
                type="submit"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <FileUp className="mr-2 h-4 w-4" />
                    Create Preview
                  </>
                )}
              </Button>
            ) : (
              <Button
                className="w-full"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                size="lg"
                type="button"
              >
                <UploadCloud className="mr-2 h-4 w-4" />
                Choose File
              </Button>
            )}

            {uploading && uploadProgress ? (
              <div className="space-y-2 rounded-md border bg-muted/20 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{uploadProgressLabel}</p>
                  <span className="text-xs font-medium text-muted-foreground">
                    {uploadProgress.percent}%
                  </span>
                </div>
                <Progress
                  aria-label="CSV upload progress"
                  className="h-2"
                  value={uploadProgress.percent}
                />
                {uploadProgressDetail ? (
                  <p className="text-xs text-muted-foreground">
                    {uploadProgressDetail}
                  </p>
                ) : null}
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Jobs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No migration jobs yet.
            </p>
          ) : (
            jobs.map((job) => (
              <button
                className={cn(
                  'w-full rounded-xl border p-4 text-left transition hover:border-foreground/20',
                  selectedJobId === job.id && 'border-foreground/30 bg-muted/40'
                )}
                key={job.id}
                onClick={() => onJobSelect(job.id)}
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium">
                    {job.original_filename}
                  </p>
                  <Badge
                    className={cn('capitalize', statusBadgeClass(job.status))}
                  >
                    {job.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {job.entity_type} · {job.processed_rows}/{job.total_rows || 0}{' '}
                  rows
                </p>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
