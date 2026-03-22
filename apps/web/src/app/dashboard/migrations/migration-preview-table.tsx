'use client';

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
  loading: boolean;
  onPageChange: (page: number) => void;
  page: number;
  pageSize: number;
  rows: Array<{
    id: string;
    meta: Record<string, unknown>;
    normalized_payload: Record<string, unknown> | null;
    row_number: number;
    row_status: 'create' | 'update' | 'duplicate' | 'invalid';
    source_external_id: string | null;
    validation_errors: string[];
  }>;
  total: number;
}

function statusClassName(status: string) {
  if (status === 'create') return 'bg-emerald-500/10 text-emerald-700';
  if (status === 'update') return 'bg-blue-500/10 text-blue-700';
  if (status === 'duplicate') return 'bg-amber-500/10 text-amber-700';
  return 'bg-rose-500/10 text-rose-700';
}

function formatPrimaryText(
  entityType: 'orders' | 'products',
  payload: Record<string, unknown> | null
) {
  if (!payload) {
    return 'Invalid row';
  }

  if (entityType === 'orders') {
    const customer = payload.customer as Record<string, unknown> | undefined;
    return `${payload.orderNumber || 'Unknown order'} · ${customer?.fullName || 'Unknown customer'}`;
  }

  return `${payload.title || 'Untitled product'}${payload.sku ? ` · ${payload.sku}` : ''}`;
}

function formatSecondaryText(
  entityType: 'orders' | 'products',
  payload: Record<string, unknown> | null,
  meta: Record<string, unknown>
) {
  if (!payload) {
    return 'Validation errors require review';
  }

  if (entityType === 'orders') {
    const items = Array.isArray(payload.items) ? payload.items.length : 0;
    const unmatched = Number(meta.unmatchedItemCount || 0);
    const itemLabel = items === 1 ? 'item' : 'items';
    return `${payload.total || 0} ${payload.currency || 'NGN'} · ${items} ${itemLabel}${unmatched > 0 ? ` · ${unmatched} unmatched` : ''}`;
  }

  return `${payload.price || 0} ${payload.currency || 'NGN'} · ${payload.status || 'draft'}`;
}

export default function MigrationPreviewTable({
  entityType,
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
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Row</TableHead>
              <TableHead>Status</TableHead>
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
                  No preview rows available yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {row.row_number}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        'capitalize',
                        statusClassName(row.row_status)
                      )}
                    >
                      {row.row_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {row.source_external_id || 'n/a'}
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
