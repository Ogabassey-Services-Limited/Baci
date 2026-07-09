'use client';

import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { RepairImportDraftRow } from '@/lib/repairs/import-match';
import { cn } from '@/lib/utils';

/**
 * A single reviewable row in the AI paste-import table. `draft` is the
 * original AI-matched row (kept for its status/suggestion/id fields); the
 * other fields are the merchant-editable copies shown in the inputs.
 */
export interface EditableImportRow {
  draft: RepairImportDraftRow;
  brand: string;
  model: string;
  repairType: string;
  price: number;
  partQuality: string;
  rejected: boolean;
}

interface ImportReviewTableProps {
  rows: EditableImportRow[];
  readOnly?: boolean;
  onChange: (index: number, patch: Partial<EditableImportRow>) => void;
  onToggleReject: (index: number) => void;
}

const STATUS_BADGE: Record<
  RepairImportDraftRow['status'],
  {
    label: string;
    variant: 'outline' | 'secondary' | 'destructive';
    className: string;
  }
> = {
  new_device: {
    label: 'New device',
    variant: 'outline',
    className: 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-50',
  },
  existing_device: {
    label: 'Existing',
    variant: 'secondary',
    className: 'bg-green-100 text-green-800 hover:bg-green-100',
  },
  ambiguous: {
    label: 'Ambiguous',
    variant: 'destructive',
    className: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  },
};

export default function ImportReviewTable({
  rows,
  readOnly = false,
  onChange,
  onToggleReject,
}: ImportReviewTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Status</TableHead>
          <TableHead>Brand</TableHead>
          <TableHead>Model</TableHead>
          <TableHead>Repair type</TableHead>
          <TableHead>Price (₦)</TableHead>
          <TableHead>Part quality</TableHead>
          <TableHead>Include?</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => {
          const badge = STATUS_BADGE[row.draft.status];
          const rowNumber = index + 1;
          return (
            <TableRow
              // biome-ignore lint/suspicious/noArrayIndexKey: review rows are a fixed-order, in-place-editable list identified by position
              key={`${row.draft.brand}-${row.draft.model}-${row.draft.repairType}-${index}`}
              className={cn(row.rejected && 'opacity-50')}
            >
              <TableCell>
                <Badge variant={badge.variant} className={badge.className}>
                  {badge.label}
                </Badge>
                {row.draft.status === 'ambiguous' && (
                  <p className="mt-1 max-w-xs text-muted-foreground text-xs">
                    Picking a device on commit is not needed — a new device is
                    created unless you edit the brand/model to match an existing
                    one.
                  </p>
                )}
              </TableCell>
              <TableCell>
                <Input
                  aria-label={`Brand — row ${rowNumber}`}
                  readOnly={readOnly}
                  value={row.brand}
                  onChange={(event) =>
                    onChange(index, { brand: event.target.value })
                  }
                />
              </TableCell>
              <TableCell>
                <Input
                  aria-label={`Model — row ${rowNumber}`}
                  readOnly={readOnly}
                  value={row.model}
                  onChange={(event) =>
                    onChange(index, { model: event.target.value })
                  }
                />
              </TableCell>
              <TableCell>
                <Input
                  aria-label={`Repair type — row ${rowNumber}`}
                  readOnly={readOnly}
                  value={row.repairType}
                  onChange={(event) =>
                    onChange(index, { repairType: event.target.value })
                  }
                />
              </TableCell>
              <TableCell>
                <Input
                  aria-label={`Price — row ${rowNumber}`}
                  type="number"
                  min={0}
                  readOnly={readOnly}
                  value={row.price}
                  onChange={(event) =>
                    onChange(index, { price: Number(event.target.value) })
                  }
                />
              </TableCell>
              <TableCell>
                <Input
                  aria-label={`Part quality — row ${rowNumber}`}
                  placeholder="e.g. OEM"
                  readOnly={readOnly}
                  value={row.partQuality}
                  onChange={(event) =>
                    onChange(index, { partQuality: event.target.value })
                  }
                />
              </TableCell>
              <TableCell>
                <Switch
                  aria-label={`Include row ${rowNumber}`}
                  checked={!row.rejected}
                  disabled={readOnly}
                  onCheckedChange={() => onToggleReject(index)}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
