'use client';

import { Loader2, Mail, RefreshCw } from 'lucide-react';
import { getMigrationSuggestedAction } from '@/app/dashboard/migrations/migration-filter-helpers';
import MigrationJobNextStepMessage from '@/app/dashboard/migrations/migration-job-next-step-message';
import MigrationJobProgressCard from '@/app/dashboard/migrations/migration-job-progress-card';
import type {
  ImportJobDetail,
  MigrationPreviewFilter,
} from '@/app/dashboard/migrations/migration-types';
import {
  decorateImportJob,
  statusBadgeClass,
} from '@/app/dashboard/migrations/migration-utils';
import ReceiptCampaignSummary from '@/app/dashboard/migrations/receipt-campaign-summary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MigrationJobSummaryProps {
  activeFilter: MigrationPreviewFilter;
  acting: boolean;
  error: string | null;
  loading: boolean;
  onFilterChange: (filter: MigrationPreviewFilter) => void | Promise<void>;
  onCommit: () => Promise<void>;
  onNotify: () => Promise<void>;
  onRefresh: () => Promise<void>;
  selectedJob: ImportJobDetail | null;
}

export default function MigrationJobSummary({
  activeFilter,
  acting,
  error,
  loading,
  onFilterChange,
  onCommit,
  onNotify,
  onRefresh,
  selectedJob,
}: MigrationJobSummaryProps) {
  const decoratedJob = selectedJob ? decorateImportJob(selectedJob) : null;
  const summary = (decoratedJob?.summary || {}) as Record<string, unknown>;
  const validRows = Number(summary.validRows || 0);
  const invalidRows = Number(summary.invalidRows || 0);
  const receiptReadyOrders = Number(summary.receiptReadyOrders || 0);
  const receiptCampaign = decoratedJob?.receiptCampaign ?? null;
  const sentCountFallback = Number(summary.sentCount || 0);
  const suggestedAction = getMigrationSuggestedAction({
    activeFilter,
    invalidRows,
    validRows,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Selected Job</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Review the preview, then import or notify when the job is ready.
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
              <button
                aria-pressed={activeFilter === 'all'}
                className={cn(
                  'rounded-xl border p-4 text-left transition-colors',
                  activeFilter === 'all'
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-primary/40'
                )}
                onClick={() => onFilterChange('all')}
                type="button"
              >
                <p className="text-xs uppercase text-muted-foreground">
                  All Rows
                </p>
                <output
                  aria-label="All rows"
                  className="mt-2 block text-2xl font-semibold"
                >
                  {selectedJob.total_rows || 0}
                </output>
              </button>
              <button
                aria-pressed={activeFilter === 'importable'}
                className={cn(
                  'rounded-xl border p-4 text-left transition-colors',
                  validRows === 0 && 'cursor-not-allowed opacity-60',
                  activeFilter === 'importable'
                    ? 'border-emerald-500 bg-emerald-500/5'
                    : 'hover:border-emerald-500/40'
                )}
                disabled={validRows === 0}
                onClick={() => onFilterChange('importable')}
                type="button"
              >
                <p className="text-xs uppercase text-muted-foreground">
                  Ready To Import
                </p>
                <output
                  aria-label="Valid rows"
                  className="mt-2 block text-2xl font-semibold"
                >
                  {validRows}
                </output>
              </button>
              <button
                aria-pressed={activeFilter === 'needs_fix'}
                className={cn(
                  'rounded-xl border p-4 text-left transition-colors',
                  invalidRows === 0 && 'cursor-not-allowed opacity-60',
                  activeFilter === 'needs_fix'
                    ? 'border-amber-500 bg-amber-500/5'
                    : 'hover:border-amber-500/40'
                )}
                disabled={invalidRows === 0}
                onClick={() => onFilterChange('needs_fix')}
                type="button"
              >
                <p className="text-xs uppercase text-muted-foreground">
                  Needs Fix
                </p>
                <output
                  aria-label="Invalid rows"
                  className="mt-2 block text-2xl font-semibold"
                >
                  {invalidRows}
                </output>
              </button>
              <div className="rounded-xl border p-4">
                <p className="text-xs uppercase text-muted-foreground">
                  Receipt Ready
                </p>
                <output
                  aria-label="Receipt ready orders"
                  className="mt-2 block text-2xl font-semibold"
                >
                  {receiptReadyOrders}
                </output>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{suggestedAction.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {suggestedAction.description}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeFilter !== 'all' ? (
                    <Button
                      onClick={() => onFilterChange('all')}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Show all rows
                    </Button>
                  ) : null}
                  {activeFilter === 'needs_fix' && validRows > 0 ? (
                    <Button
                      onClick={() => onFilterChange('importable')}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Show ready rows
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <MigrationJobProgressCard
              processedRows={selectedJob.processed_rows}
              status={selectedJob.status}
              summary={summary}
              totalRows={selectedJob.total_rows}
            />

            {decoratedJob ? (
              <MigrationJobNextStepMessage job={decoratedJob} />
            ) : null}

            {receiptCampaign ? (
              <ReceiptCampaignSummary
                receiptCampaign={receiptCampaign}
                sentCountFallback={sentCountFallback}
              />
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button
                disabled={!selectedJob.canCommit || acting}
                onClick={() => void onCommit()}
                type="button"
              >
                {acting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Import
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
