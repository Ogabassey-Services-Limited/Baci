'use client';

import { FileUp, Loader2, UploadCloud } from 'lucide-react';
import { useState } from 'react';
import { statusBadgeClass } from '@/app/dashboard/migrations/migration-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ImportJobListItem } from './migration-types';

interface MigrationSidebarProps {
  entityType: 'orders' | 'products';
  jobs: ImportJobListItem[];
  onEntityTypeChange: (value: 'orders' | 'products') => void;
  onFileChange: (file: File | null) => void;
  onJobSelect: (jobId: string) => void;
  onUpload: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
  selectedJobId: string | null;
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
  uploading,
}: MigrationSidebarProps) {
  const [hasSelectedFile, setHasSelectedFile] = useState(false);

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

            <label className="block text-sm font-medium">
              CSV file
              <input
                accept=".csv,text/csv"
                className="mt-2 block w-full rounded-md border px-3 py-2 text-sm"
                name="csvFile"
                onChange={(event) => {
                  const nextFile = event.target.files?.[0] || null;
                  setHasSelectedFile(Boolean(nextFile));
                  onFileChange(nextFile);
                }}
                type="file"
              />
            </label>

            <Button className="w-full" disabled={uploading} type="submit">
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
