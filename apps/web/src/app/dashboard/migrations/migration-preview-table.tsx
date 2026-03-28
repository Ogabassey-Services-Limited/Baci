'use client';

import {
  getMigrationEmptyStateCopy,
  getMigrationFilterDescription,
  getMigrationFilterHeading,
} from '@/app/dashboard/migrations/migration-filter-helpers';
import MigrationOrderSourceChip from '@/app/dashboard/migrations/migration-order-source-chip';
import {
  getMigrationRowPrimaryText,
  getMigrationRowRecordText,
  getMigrationRowSecondaryText,
  getMigrationRowSourceDetails,
} from '@/app/dashboard/migrations/migration-preview-row-display';
import type {
  ImportJobRowStatus,
  ImportJobRowsResponse,
  MigrationPreviewFilter,
} from '@/app/dashboard/migrations/migration-types';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface MigrationPreviewTableProps {
  entityType: 'orders' | 'products';
  filter: MigrationPreviewFilter;
  loading: boolean;
  onPageChange: (page: number) => void;
  page: number;
  pageSize: number;
  rows: ImportJobRowsResponse['rows'];
  total: number;
}

function statusClassName(status: ImportJobRowStatus) {
  if (status === 'create') return 'bg-emerald-500/10 text-emerald-700';
  if (status === 'update') return 'bg-blue-500/10 text-blue-700';
  if (status === 'duplicate') return 'bg-amber-500/10 text-amber-700';
  return 'bg-rose-500/10 text-rose-700';
}

function getActionLabel(status: ImportJobRowStatus) {
  if (status === 'create') return 'Create new';
  if (status === 'update') return 'Update existing';
  if (status === 'duplicate') return 'Duplicate / skipped';
  return 'Needs fix';
}

export default function MigrationPreviewTable({
  entityType,
  filter,
  loading,
  onPageChange,
  page,
  pageSize,
  rows,
  total,
}: MigrationPreviewTableProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      {getMigrationFilterHeading(filter) ? (
        <div className="rounded-xl border bg-muted/20 px-4 py-3">
          <p className="text-sm font-medium">
            {getMigrationFilterHeading(filter)}
          </p>
          <p className="text-sm text-muted-foreground">
            {getMigrationFilterDescription(filter)}
          </p>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                {entityType === 'orders' ? 'Order' : 'Product'}
              </TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Preview</TableHead>
              <TableHead>Errors</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  Loading preview rows...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  {getMigrationEmptyStateCopy(filter)}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const sourceDetails = getMigrationRowSourceDetails(
                  entityType,
                  row
                );

                return (
                  <TableRow key={row.id}>
                    <TableCell className="min-w-[180px]">
                      <div className="space-y-1">
                        <p className="font-medium">
                          {getMigrationRowRecordText(entityType, row)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          CSV Row {row.row_number}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          'capitalize',
                          statusClassName(row.row_status)
                        )}
                      >
                        {getActionLabel(row.row_status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="min-w-[170px]">
                      {entityType === 'orders' ? (
                        sourceDetails ? (
                          <MigrationOrderSourceChip
                            sourceChannel={sourceDetails.sourceChannel}
                            sourceOrigin={sourceDetails.sourceOrigin}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            n/a
                          </span>
                        )
                      ) : (
                        <Badge variant="outline">Bumpa</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {getMigrationRowPrimaryText(entityType, row)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {getMigrationRowSecondaryText(entityType, row)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.validation_errors.length > 0
                        ? row.validation_errors.join(', ')
                        : 'No validation errors'}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>
          Showing {rows.length === 0 ? 0 : (page - 1) * pageSize + 1} to{' '}
          {Math.min(page * pageSize, total)} of {total}
        </p>
        <div className="flex items-center gap-2">
          <button
            aria-label={`Previous page, page ${Math.max(1, page - 1)} of ${totalPages}`}
            className="rounded-md border px-3 py-1 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            type="button"
          >
            Previous
          </button>
          <span>
            Page {page} / {totalPages}
          </span>
          <button
            aria-label={`Next page, page ${Math.min(totalPages, page + 1)} of ${totalPages}`}
            className="rounded-md border px-3 py-1 disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            type="button"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
