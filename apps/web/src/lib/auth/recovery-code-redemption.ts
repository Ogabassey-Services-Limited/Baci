import 'server-only';

import {
  hashRecoveryCodeCandidate,
  RECOVERY_CODE_COUNT,
  verifyRecoveryCodeHash,
} from './recovery-codes';

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
  /** Mark a single code consumed. Returns false when another request already consumed it. */
  markCodeUsed(codeId: string): Promise<boolean>;
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

  // 2. Compute the candidate HMAC once, then compare against a padded active
  //    set without short-circuiting. The active set should contain exactly
  //    RECOVERY_CODE_COUNT rows; padding avoids making normal remaining-code
  //    counts observable through loop duration.
  const codes = await store.listActiveCodes(userId);
  const candidateHash = hashRecoveryCodeCandidate(input, pepper);
  const comparisons = Math.max(RECOVERY_CODE_COUNT, codes.length);
  const dummyHash = '0'.repeat(64);
  let match: RecoveryCodeRecord | null = null;
  for (let i = 0; i < comparisons; i += 1) {
    const code = codes[i] ?? null;
    if (verifyRecoveryCodeHash(candidateHash, code?.codeHash ?? dummyHash)) {
      match = code;
    }
  }

  if (!match) {
    await store.recordAttempt({ userId, ipHash, succeeded: false });
    return { ok: false, reason: 'invalid' };
  }

  // 3. Single-use: atomically claim the code, then log the success. A false
  //    claim means another concurrent request consumed the matched code first.
  const claimed = await store.markCodeUsed(match.id);
  if (!claimed) {
    await store.recordAttempt({ userId, ipHash, succeeded: false });
    return { ok: false, reason: 'invalid' };
  }

  await store.recordAttempt({ userId, ipHash, succeeded: true });
  return { ok: true, codeId: match.id };
}
