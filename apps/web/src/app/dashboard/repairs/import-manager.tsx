'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { ImportCommitCounts } from '@/lib/repairs/import-commit';
import type { RepairImportDraftRow } from '@/lib/repairs/import-match';
import type { RepairImportCommitRow } from '@/schemas/repair-catalog-admin';
import { commitImport, parseImport } from './catalog-api';
import ImportReviewTable, {
  type EditableImportRow,
} from './import-review-table';

function toEditableRow(draft: RepairImportDraftRow): EditableImportRow {
  return {
    draft,
    brand: draft.brand,
    model: draft.model,
    repairType: draft.repairType,
    price: draft.price,
    partQuality: draft.partQuality ?? '',
    rejected: false,
  };
}

function toCommitRow(row: EditableImportRow): RepairImportCommitRow {
  return {
    brand: row.brand,
    model: row.model,
    repairType: row.repairType,
    price: row.price,
    partQuality: row.partQuality.trim() || null,
    isFromPrice: true,
    deviceId: row.draft.deviceId ?? null,
    serviceTypeId: row.draft.serviceTypeId ?? null,
    productId: row.draft.suggestedProductId ?? null,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}

export default function ImportManager() {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [rows, setRows] = useState<EditableImportRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [hasParsedOnce, setHasParsedOnce] = useState(false);
  const [results, setResults] = useState<ImportCommitCounts | null>(null);

  const includedCount = rows.filter((row) => !row.rejected).length;

  async function handleParse() {
    if (!text.trim() || parsing) {
      return;
    }
    setParsing(true);
    setResults(null);
    try {
      const draftRows = await parseImport(text);
      setRows(draftRows.map(toEditableRow));
      setHasParsedOnce(true);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not parse the price list',
        description: errorMessage(error),
      });
    } finally {
      setParsing(false);
    }
  }

  function handleRowChange(index: number, patch: Partial<EditableImportRow>) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  function handleToggleReject(index: number) {
    setRows((prev) =>
      prev.map((row, i) =>
        i === index ? { ...row, rejected: !row.rejected } : row
      )
    );
  }

  async function handleCommit() {
    const commitRows = rows.filter((row) => !row.rejected).map(toCommitRow);
    if (commitRows.length === 0 || committing) {
      return;
    }
    setCommitting(true);
    try {
      const counts = await commitImport(commitRows);
      setResults(counts);
      setRows([]);
      setText('');
      setHasParsedOnce(false);
      toast({
        title: 'Import committed',
        description: `${commitRows.length} row${commitRows.length === 1 ? '' : 's'} added to your catalogue.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not commit the import',
        description: errorMessage(error),
      });
    } finally {
      setCommitting(false);
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>AI paste-import</CardTitle>
        <CardDescription>
          Paste a WhatsApp-style repair price list and our AI will parse it into
          rows you can review, edit, and selectively add to your catalogue.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="import-paste">Price list</Label>
          <Textarea
            id="import-paste"
            placeholder={
              'e.g.\niPhone 12 screen replacement - 25000\niPhone 12 battery - 12000'
            }
            rows={6}
            disabled={parsing}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
          <Button
            type="button"
            onClick={handleParse}
            disabled={parsing || !text.trim()}
          >
            {parsing ? 'Parsing…' : 'Parse list'}
          </Button>
        </div>

        {rows.length === 0 && hasParsedOnce && !results && (
          <p className="text-muted-foreground text-sm">
            No rows were found in that text. Check the format and try again.
          </p>
        )}

        {rows.length === 0 && !hasParsedOnce && !results && (
          <p className="text-muted-foreground text-sm">
            Nothing to review yet. Paste your price list above and click
            &quot;Parse list&quot; — matched devices, part qualities, and repair
            types are pre-filled for you to confirm before anything is saved.
          </p>
        )}

        {rows.length > 0 && (
          <div className="space-y-3">
            <ImportReviewTable
              rows={rows}
              onChange={handleRowChange}
              onToggleReject={handleToggleReject}
            />
            <div className="flex items-center justify-between gap-4">
              <p className="text-muted-foreground text-sm">
                {includedCount} of {rows.length} row
                {rows.length === 1 ? '' : 's'} will be imported
              </p>
              <Button
                type="button"
                onClick={handleCommit}
                disabled={committing || includedCount === 0}
              >
                {committing
                  ? 'Committing…'
                  : `Commit ${includedCount} row${includedCount === 1 ? '' : 's'}`}
              </Button>
            </div>
          </div>
        )}

        {results && (
          <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-4 sm:grid-cols-4">
            <div>
              <p className="font-semibold text-lg">
                {results.serviceTypesCreated}
              </p>
              <p className="text-muted-foreground text-xs">
                Service types created
              </p>
            </div>
            <div>
              <p className="font-semibold text-lg">{results.devicesCreated}</p>
              <p className="text-muted-foreground text-xs">Devices created</p>
            </div>
            <div>
              <p className="font-semibold text-lg">{results.quotesCreated}</p>
              <p className="text-muted-foreground text-xs">Quotes created</p>
            </div>
            <div>
              <p className="font-semibold text-lg">{results.quotesUpdated}</p>
              <p className="text-muted-foreground text-xs">Quotes updated</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
