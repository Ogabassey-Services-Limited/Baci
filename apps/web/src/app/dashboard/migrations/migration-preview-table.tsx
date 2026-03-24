'use client';

import MigrationOrderSourceChip from '@/app/dashboard/migrations/migration-order-source-chip';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type {
  NormalizedImportedOrder,
  NormalizedImportedProduct,
} from '@/lib/imports/bumpa/bumpa-types';
import { cn } from '@/lib/utils';
import type {
  ImportJobRowStatus,
  ImportJobRowsResponse,
  MigrationPreviewFilter,
} from './migration-types';

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

function isNormalizedImportedOrder(
  payload: NormalizedImportedOrder | NormalizedImportedProduct | null
): payload is NormalizedImportedOrder {
  return Boolean(payload && 'orderNumber' in payload && 'customer' in payload);
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

function getEmptyStateCopy(filter: MigrationPreviewFilter) {
  if (filter === 'importable') {
    return 'No rows are currently ready to import.';
  }

  if (filter === 'needs_fix') {
    return 'No rows currently need fixes.';
  }

  return 'No preview rows available yet.';
}

function getFilterHeading(filter: MigrationPreviewFilter) {
  if (filter === 'importable') return 'Showing rows ready to import';
  if (filter === 'needs_fix') return 'Showing rows that need fixes';
  return null;
}

function getFilterDescription(filter: MigrationPreviewFilter) {
  if (filter === 'importable') {
    return 'These rows will be created or updated when you import this job.';
  }

  if (filter === 'needs_fix') {
    return 'These rows will be skipped until you correct the CSV and create a fresh preview.';
  }

  return null;
}

function formatPrimaryText(
  entityType: 'orders' | 'products',
  payload: NormalizedImportedOrder | NormalizedImportedProduct | null
) {
  if (!payload) {
    return 'Invalid row';
  }

  if (entityType === 'orders') {
    if (!isNormalizedImportedOrder(payload)) {
      return 'Unknown customer';
    }

    return payload.customer.fullName || 'Unknown customer';
  }

  if (isNormalizedImportedOrder(payload)) {
    return 'Untitled product';
  }

  return `${payload.title || 'Untitled product'}${payload.sku ? ` · ${payload.sku}` : ''}`;
}

function formatRecordText(
  entityType: 'orders' | 'products',
  payload: NormalizedImportedOrder | NormalizedImportedProduct | null,
  rowNumber: number
) {
  if (!payload) {
    return entityType === 'orders'
      ? `Order ${rowNumber}`
      : `Product ${rowNumber}`;
  }

  if (entityType === 'orders') {
    if (!isNormalizedImportedOrder(payload)) {
      return `Order ${rowNumber}`;
    }

    return payload.orderNumber || `Order ${rowNumber}`;
  }

  if (isNormalizedImportedOrder(payload)) {
    return `Product ${rowNumber}`;
  }

  return payload.title || payload.sku || `Product ${rowNumber}`;
}

function formatSecondaryText(
  entityType: 'orders' | 'products',
  payload: NormalizedImportedOrder | NormalizedImportedProduct | null,
  meta: Record<string, unknown>
) {
  if (!payload) {
    return 'Validation errors require review';
  }

  if (entityType === 'orders') {
    if (!isNormalizedImportedOrder(payload)) {
      return 'Validation errors require review';
    }

    const items = payload.items.length;
    const unmatched = Number(meta.unmatchedItemCount || 0);
    const itemLabel = items === 1 ? 'item' : 'items';
    return `${payload.total || 0} ${payload.currency || 'NGN'} · ${items} ${itemLabel}${unmatched > 0 ? ` · ${unmatched} unmatched` : ''}`;
  }

  if (isNormalizedImportedOrder(payload)) {
    return 'Validation errors require review';
  }

  return `${payload.price || 0} ${payload.currency || 'NGN'} · ${payload.status || 'draft'}`;
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
      {getFilterHeading(filter) ? (
        <div className="rounded-xl border bg-muted/20 px-4 py-3">
          <p className="text-sm font-medium">{getFilterHeading(filter)}</p>
          <p className="text-sm text-muted-foreground">
            {getFilterDescription(filter)}
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
                  {getEmptyStateCopy(filter)}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="min-w-[180px]">
                    <div className="space-y-1">
                      <p className="font-medium">
                        {formatRecordText(
                          entityType,
                          row.normalized_payload,
                          row.row_number
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Row {row.row_number}
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
                      isNormalizedImportedOrder(row.normalized_payload) ? (
                        <MigrationOrderSourceChip
                          sourceChannel={row.normalized_payload.sourceChannel}
                          sourceOrigin={row.normalized_payload.sourceOrigin}
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
                        {formatPrimaryText(entityType, row.normalized_payload)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatSecondaryText(
                          entityType,
                          row.normalized_payload,
                          row.meta
                        )}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.validation_errors.length > 0
                      ? row.validation_errors.join(', ')
                      : 'No validation errors'}
                  </TableCell>
                </TableRow>
              ))
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
