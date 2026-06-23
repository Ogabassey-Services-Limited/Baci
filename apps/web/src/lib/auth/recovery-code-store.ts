import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import type {
  RecoveryAttempt,
  RecoveryCodeRecord,
  RecoveryCodeStore,
} from './recovery-code-redemption';

const RECOVERY_CODES_TABLE = 'merchant_auth_recovery_codes';
const RECOVERY_ATTEMPTS_TABLE = 'merchant_auth_recovery_attempts';

/** Failed recovery attempts within this window count toward lockout. */
export const RECOVERY_FAILURE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Supabase-backed RecoveryCodeStore. Uses the service-role client because the
 * backing tables are RLS server-only (see the recovery-codes migration). Every
 * method fails closed (throws) on a query error so the caller can deny recovery
 * rather than silently proceeding.
 */
export function createRecoveryCodeStore(): RecoveryCodeStore {
  const supabase = createAdminClient();

  return {
    async listActiveCodes(userId: string): Promise<RecoveryCodeRecord[]> {
      const { data, error } = await supabase
        .from(RECOVERY_CODES_TABLE)
        .select('id, code_hash')
        .eq('user_id', userId)
        .is('used_at', null)
        .is('revoked_at', null);
      if (error) {
        throw new Error(`Failed to load recovery codes: ${error.message}`);
      }
      const rows = (data ?? []) as Array<{ id: string; code_hash: string }>;
      return rows.map((row) => ({ id: row.id, codeHash: row.code_hash }));
    },

    async markCodeUsed(codeId: string): Promise<boolean> {
      // `is('used_at', null)` makes consumption atomic: a concurrent redeem of
      // the same code updates zero rows. Supabase update() returns no rows by
      // default, so select the id back and treat an empty result as not claimed.
      const { data, error } = await supabase
        .from(RECOVERY_CODES_TABLE)
        .update({ used_at: new Date().toISOString() })
        .eq('id', codeId)
        .is('used_at', null)
        .select('id');
      if (error) {
        throw new Error(`Failed to consume recovery code: ${error.message}`);
      }
      return Array.isArray(data) && data.length > 0;
    },

    async countRecentFailures(userId: string): Promise<number> {
      const cutoff = new Date(
        Date.now() - RECOVERY_FAILURE_WINDOW_MS
      ).toISOString();
      const { count, error } = await supabase
        .from(RECOVERY_ATTEMPTS_TABLE)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('succeeded', false)
        .gte('created_at', cutoff);
      if (error) {
        throw new Error(`Failed to count recovery attempts: ${error.message}`);
      }
      return count ?? 0;
    },

    async recordAttempt({
      userId,
      ipHash,
      succeeded,
    }: RecoveryAttempt): Promise<void> {
      const { error } = await supabase.from(RECOVERY_ATTEMPTS_TABLE).insert({
        user_id: userId,
        ip_hash: ipHash,
        succeeded,
      });
      if (error) {
        throw new Error(`Failed to record recovery attempt: ${error.message}`);
      }
    },
  };
}
