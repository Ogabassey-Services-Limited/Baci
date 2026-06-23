import { verifyRecoveryCode } from './recovery-codes';

/**
 * Store-agnostic redemption of a merchant recovery code.
 *
 * Enforces the NIST/OWASP requirements that aren't pure crypto:
 * - single-use (the store exposes only unused codes from the active set),
 * - brute-force lockout (checked BEFORE any verification),
 * - attempt logging incl. no-match attempts (so wrong codes still count).
 *
 * The Supabase-backed store implementation is wired separately; this module is
 * pure orchestration so it can be unit-tested against an in-memory fake.
 */

export type RecoveryCodeRecord = {
  id: string;
  codeHash: string;
};

export type RecoveryAttempt = {
  userId: string;
  ipHash: string;
  succeeded: boolean;
};

export interface RecoveryCodeStore {
  /** Unused, non-revoked codes from the user's ACTIVE code set. */
  listActiveCodes(userId: string): Promise<RecoveryCodeRecord[]>;
  /** Mark a single code consumed — single-use. */
  markCodeUsed(codeId: string): Promise<void>;
  /** Failures within the lockout window (per user, incl. no-match attempts). */
  countRecentFailures(userId: string): Promise<number>;
  /** Append to the attempt ledger. */
  recordAttempt(attempt: RecoveryAttempt): Promise<void>;
}

export type RedeemResult =
  | { ok: true; codeId: string }
  | { ok: false; reason: 'locked' | 'invalid' };

export const RECOVERY_MAX_FAILURES = 10;

type RedeemParams = {
  userId: string;
  ipHash: string;
  input: string;
  pepper: string;
  store: RecoveryCodeStore;
};

export async function redeemRecoveryCode({
  userId,
  ipHash,
  input,
  pepper,
  store,
}: RedeemParams): Promise<RedeemResult> {
  // 1. Lockout check FIRST — never look up or verify codes while locked.
  const failures = await store.countRecentFailures(userId);
  if (failures >= RECOVERY_MAX_FAILURES) {
    return { ok: false, reason: 'locked' };
  }

  // 2. Compare against every active code without short-circuiting, so timing
  //    doesn't leak which/how many codes exist. Codes are unique, so at most one
  //    matches.
  const codes = await store.listActiveCodes(userId);
  let match: RecoveryCodeRecord | null = null;
  for (const code of codes) {
    if (verifyRecoveryCode(input, code.codeHash, pepper)) {
      match = code;
    }
  }

  if (!match) {
    await store.recordAttempt({ userId, ipHash, succeeded: false });
    return { ok: false, reason: 'invalid' };
  }

  // 3. Single-use: consume the code, then log the success.
  await store.markCodeUsed(match.id);
  await store.recordAttempt({ userId, ipHash, succeeded: true });
  return { ok: true, codeId: match.id };
}
