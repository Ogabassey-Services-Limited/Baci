import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import type { RecoveryCodeIssuerStore } from './recovery-code-issuance';
import type {
  RecoveryAttempt,
  RecoveryAttemptReservation,
  RecoveryCodeClaim,
  RecoveryCodeRecord,
  RecoveryCodeStore,
} from './recovery-code-redemption';
import type { RecoveryReadinessStore } from './recovery-readiness';

const RECOVERY_CODES_TABLE = 'merchant_auth_recovery_codes';
const RECOVERY_ATTEMPTS_TABLE = 'merchant_auth_recovery_attempts';
const RECOVERY_READINESS_TABLE = 'merchant_auth_readiness';
const BEGIN_RECOVERY_ATTEMPT_RPC = 'begin_merchant_auth_recovery_attempt';
const CLAIM_RECOVERY_CODE_RPC = 'claim_merchant_auth_recovery_code';
const CREATE_RECOVERY_CODE_SET_RPC = 'create_recovery_code_set';
const ACKNOWLEDGE_RECOVERY_CODE_SET_RPC = 'acknowledge_recovery_code_set';

/** Failed recovery attempts within this window count toward lockout. */
export const RECOVERY_FAILURE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Supabase-backed RecoveryCodeStore. Uses the service-role client because the
 * backing tables are RLS server-only (see the recovery-codes migration). Every
 * method fails closed (throws) on a query error so the caller can deny recovery
 * rather than silently proceeding.
 */
export function createRecoveryCodeStore(): RecoveryCodeStore &
  RecoveryCodeIssuerStore &
  RecoveryReadinessStore {
  const supabase = createAdminClient();

  return {
    async createCodeSet(userId: string, codeHashes: string[]): Promise<string> {
      // Creates a pending set only. The acknowledged set remains active until
      // the merchant confirms the new codes were saved.
      const { data, error } = await supabase.rpc(CREATE_RECOVERY_CODE_SET_RPC, {
        p_code_hashes: codeHashes,
        p_user_id: userId,
      });
      if (error) {
        throw new Error(`Failed to create recovery code set: ${error.message}`);
      }
      return data as string;
    },

    async acknowledgeCodeSet(
      userId: string,
      codeSetId: string
    ): Promise<boolean> {
      const { data, error } = await supabase.rpc(
        ACKNOWLEDGE_RECOVERY_CODE_SET_RPC,
        {
          p_code_set_id: codeSetId,
          p_user_id: userId,
        }
      );
      if (error) {
        throw new Error(
          `Failed to acknowledge recovery codes: ${error.message}`
        );
      }
      return data === true;
    },

    async getActiveCodeSetId(userId: string): Promise<string | null> {
      const { data: readiness, error: readinessError } = await supabase
        .from(RECOVERY_READINESS_TABLE)
        .select('acknowledged_code_set_id')
        .eq('user_id', userId)
        .maybeSingle();
      if (readinessError) {
        throw new Error(
          `Failed to load recovery readiness: ${readinessError.message}`
        );
      }

      return (
        (readiness as { acknowledged_code_set_id?: string | null } | null)
          ?.acknowledged_code_set_id ?? null
      );
    },

    async listActiveCodes(
      userId: string,
      codeSetId: string
    ): Promise<RecoveryCodeRecord[]> {
      const { data, error } = await supabase
        .from(RECOVERY_CODES_TABLE)
        .select('id, code_hash')
        .eq('user_id', userId)
        .eq('code_set_id', codeSetId)
        .is('used_at', null)
        .is('revoked_at', null);
      if (error) {
        throw new Error(`Failed to load recovery codes: ${error.message}`);
      }
      const rows = (data ?? []) as Array<{ id: string; code_hash: string }>;
      return rows.map((row) => ({ id: row.id, codeHash: row.code_hash }));
    },

    async beginAttempt({
      userId,
      ipHash,
      codeSetId,
      maxFailures,
    }: RecoveryAttemptReservation): Promise<string | null> {
      const cutoff = new Date(
        Date.now() - RECOVERY_FAILURE_WINDOW_MS
      ).toISOString();
      const { data, error } = await supabase.rpc(BEGIN_RECOVERY_ATTEMPT_RPC, {
        p_code_set_id: codeSetId,
        p_cutoff: cutoff,
        p_ip_hash: ipHash,
        p_max_failures: maxFailures,
        p_user_id: userId,
      });
      if (error) {
        throw new Error(`Failed to begin recovery attempt: ${error.message}`);
      }
      return typeof data === 'string' ? data : null;
    },

    async claimCode({
      userId,
      codeId,
      codeSetId,
      ipHash,
      attemptId,
      replacementCodeHash,
    }: RecoveryCodeClaim): Promise<boolean> {
      // The RPC runs the code claim and reserved-attempt success update in one
      // database transaction, and inserts the replacement saved code hash before
      // commit. This avoids burning a code if attempt logging/reissue fails.
      const { data, error } = await supabase.rpc(CLAIM_RECOVERY_CODE_RPC, {
        p_attempt_id: attemptId,
        p_code_id: codeId,
        p_code_set_id: codeSetId,
        p_ip_hash: ipHash,
        p_replacement_code_hash: replacementCodeHash,
        p_user_id: userId,
      });
      if (error) {
        throw new Error(`Failed to consume recovery code: ${error.message}`);
      }
      return data === true;
    },

    async recordAttempt({
      userId,
      ipHash,
      codeSetId,
      succeeded,
    }: RecoveryAttempt): Promise<void> {
      const { error } = await supabase.from(RECOVERY_ATTEMPTS_TABLE).insert({
        user_id: userId,
        ip_hash: ipHash,
        code_set_id: codeSetId,
        succeeded,
      });
      if (error) {
        throw new Error(`Failed to record recovery attempt: ${error.message}`);
      }
    },
  };
}
