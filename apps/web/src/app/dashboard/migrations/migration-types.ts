import type {
  NormalizedImportedOrder,
  NormalizedImportedProduct,
} from '@/lib/imports/bumpa/bumpa-types';
import type {
  ImportJobEntityType,
  ImportJobRowsQuery,
  ImportJobSourcePlatform,
  ImportJobStatus,
} from '@/schemas/import-jobs';
import type { ReceiptClaimCampaignStats } from '@/schemas/receipt-claim-rpc';

export type ImportJobRowStatus = 'create' | 'update' | 'duplicate' | 'invalid';

export type MigrationPreviewFilter = ImportJobRowsQuery['filter'];

export type ImportJobSourcePayload = Record<string, string>;

export interface ImportJobListItem {
  committed_at: string | null;
  created_at: string;
  entity_type: ImportJobEntityType;
  error: string | null;
  id: string;
  notified_at: string | null;
  original_filename: string;
  processed_rows: number;
  source_platform: ImportJobSourcePlatform;
  status: ImportJobStatus;
  summary: Record<string, unknown> | null;
  total_rows: number;
}

export interface ImportJobDetail extends ImportJobListItem {
  canCommit: boolean;
  canNotify: boolean;
  receiptCampaign?: ReceiptClaimCampaignStats | null;
}

export interface ImportJobRowsResponse {
  pagination: { page: number; pageSize: number; total: number };
  rows: Array<{
    id: string;
    meta: Record<string, unknown>;
    normalized_payload:
      | NormalizedImportedOrder
      | NormalizedImportedProduct
      | null;
    row_number: number;
    row_status: ImportJobRowStatus;
    source_external_id: string | null;
    source_payload: ImportJobSourcePayload;
    validation_errors: string[];
  }>;
}
