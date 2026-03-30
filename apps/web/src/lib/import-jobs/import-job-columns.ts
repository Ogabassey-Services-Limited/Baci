export const IMPORT_JOB_COLUMNS = [
  'id',
  'merchant_id',
  'created_by',
  'source_platform',
  'entity_type',
  'status',
  'original_filename',
  'storage_path',
  'content_type',
  'file_size_bytes',
  'total_rows',
  'processed_rows',
  'summary',
  'error',
  'created_at',
  'committed_at',
  'notified_at',
  'completed_at',
] as const;

export const IMPORT_JOB_SELECT = IMPORT_JOB_COLUMNS.join(', ');

export const PENDING_IMPORT_UPLOAD_COLUMNS = [
  'id',
  'merchant_id',
  'created_by',
  'client_upload_id',
  'storage_path',
  'source_platform',
  'entity_type',
  'original_filename',
  'content_type',
  'file_size_bytes',
  'claimed_at',
  'expires_at',
  'created_at',
] as const;

export const PENDING_IMPORT_UPLOAD_SELECT =
  PENDING_IMPORT_UPLOAD_COLUMNS.join(', ');
