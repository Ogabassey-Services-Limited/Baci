import { describe, expect, it } from 'vitest';
import { EXPENSE_QUIZ_PAYSTACK_PENDING_REPLAY_SOURCE_ROWS } from './supabase-history-replay-expense-pending-sources';

describe('supabase history replay expense pending sources', () => {
  it('includes the private receipt cleanup repair migration', () => {
    expect(EXPENSE_QUIZ_PAYSTACK_PENDING_REPLAY_SOURCE_ROWS).toContain(
      '20260815220000_repair_capture_private_expense_receipt_cleanup.sql'
    );
  });

  it('includes the legacy receipt storage API cleanup restoration migration', () => {
    expect(EXPENSE_QUIZ_PAYSTACK_PENDING_REPLAY_SOURCE_ROWS).toContain(
      '20260815230000_restore_legacy_receipt_storage_api_cleanup.sql'
    );
  });
});
