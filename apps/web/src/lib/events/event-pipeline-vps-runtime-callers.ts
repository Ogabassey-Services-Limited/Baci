// biome-ignore format: compact VPS worker RPC ownership map preserves the 300-line gate.
export const eventPipelineExpenseCleanupAdjacentFunctions = [
  'authorize_expense_private_receipt_cleanup_deletion',
  'authorize_legacy_expense_receipt_cleanup_deletion',
  'claim_expense_private_receipt_cleanup_candidates',
  'claim_legacy_expense_receipt_cleanup_candidates',
  'complete_expense_private_receipt_cleanup',
  'complete_legacy_expense_receipt_cleanup',
] as const;

export const eventPipelineVpsRuntimeCallers = {
  'vps-workers/jobs/cleanup-legacy-expense-receipts.mjs': [
    'authorize_legacy_expense_receipt_cleanup_deletion',
    'claim_legacy_expense_receipt_cleanup_candidates',
    'complete_legacy_expense_receipt_cleanup',
  ],
  'vps-workers/jobs/cleanup-private-expense-receipts.mjs': [
    'authorize_expense_private_receipt_cleanup_deletion',
    'claim_expense_private_receipt_cleanup_candidates',
    'complete_expense_private_receipt_cleanup',
  ],
  'vps-workers/jobs/supabase-retention-cleanup.mjs': [
    'cleanup_domain_event_pipeline_v1',
  ],
} as const;
