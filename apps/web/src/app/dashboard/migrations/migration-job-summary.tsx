'use client';

import { Loader2, Mail, RefreshCw } from 'lucide-react';
import { statusBadgeClass } from '@/app/dashboard/migrations/migration-utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ImportJobDetail } from './migration-types';

interface MigrationJobSummaryProps {
  acting: boolean;
  error: string | null;
  loading: boolean;
  onCommit: () => Promise<void>;
  onNotify: () => Promise<void>;
  onRefresh: () => Promise<void>;
  selectedJob: ImportJobDetail | null;
}

export default function MigrationJobSummary({
  acting,
  error,
  loading,
  onCommit,
  onNotify,
  onRefresh,
  selectedJob,
}: MigrationJobSummaryProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Selected Job</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Review the preview, then commit or notify when the job is ready.
          </p>
        </div>
        {selectedJob ? (
          <Button
            disabled={loading}
            onClick={() => void onRefresh()}
            type="button"
            variant="outline"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        {!selectedJob ? (
          <p className="text-sm text-muted-foreground">
            Select a job to inspect its preview rows.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              <Badge
                className={cn(
                  'capitalize',
                  statusBadgeClass(selectedJob.status)
                )}
              >
                {selectedJob.status.replace(/_/g, ' ')}
              </Badge>
              <Badge variant="outline">{selectedJob.entity_type}</Badge>
              <Badge variant="outline">{selectedJob.source_platform}</Badge>
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase text-muted-foreground">Rows</p>
                <output
                  aria-label="Rows"
                  className="mt-2 block text-2xl font-semibold"
                >
                  {selectedJob.total_rows || 0}
                </output>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase text-muted-foreground">Valid</p>
                <output
                  aria-label="Valid rows"
                  className="mt-2 block text-2xl font-semibold"
                >
                  {Number(selectedJob.summary?.validRows || 0)}
                </output>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase text-muted-foreground">
                  Invalid
                </p>
                <output
                  aria-label="Invalid rows"
                  className="mt-2 block text-2xl font-semibold"
                >
                  {Number(selectedJob.summary?.invalidRows || 0)}
                </output>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase text-muted-foreground">
                  Receipt Ready
                </p>
                <output
                  aria-label="Receipt ready orders"
                  className="mt-2 block text-2xl font-semibold"
                >
                  {Number(selectedJob.summary?.receiptReadyOrders || 0)}
                </output>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                disabled={!selectedJob.canCommit || acting}
                onClick={() => void onCommit()}
                type="button"
              >
                {acting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Commit Import
              </Button>
              <Button
                disabled={!selectedJob.canNotify || acting}
                onClick={() => void onNotify()}
                type="button"
                variant="outline"
              >
                <Mail className="mr-2 h-4 w-4" />
                Notify Customers
              </Button>
            </div>

            {selectedJob.error ? (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {selectedJob.error}
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
