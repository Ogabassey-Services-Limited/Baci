import type {
  ImportJobEntityType,
  ImportJobSourcePlatform,
} from '@/schemas/import-jobs';

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
  status: string;
  summary: Record<string, unknown> | null;
  total_rows: number;
}

export interface ImportJobDetail extends ImportJobListItem {
  canCommit: boolean;
  canNotify: boolean;
}

export interface ImportJobRowsResponse {
  pagination: { page: number; pageSize: number; total: number };
  rows: Array<{
    id: string;
    meta: Record<string, unknown>;
    normalized_payload: Record<string, unknown> | null;
    row_number: number;
    row_status: 'create' | 'update' | 'duplicate' | 'invalid';
    source_external_id: string | null;
    validation_errors: string[];
  }>;
}
