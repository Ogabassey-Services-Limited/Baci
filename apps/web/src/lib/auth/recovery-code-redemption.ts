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
  codeSetId: string | null;
  succeeded: boolean;
};

export type RecoveryFailureScope = {
  userId: string;
  ipHash: string;
  codeSetId: string;
};

export type RecoveryCodeClaim = RecoveryFailureScope & {
  codeId: string;
};

export interface RecoveryCodeStore {
  /** Currently acknowledged recovery-code set for this user. */
  getActiveCodeSetId(userId: string): Promise<string | null>;
  /** Unused, non-revoked codes from the user's ACTIVE code set. */
  listActiveCodes(
    userId: string,
    codeSetId: string
  ): Promise<RecoveryCodeRecord[]>;
  /**
   * Atomically mark a single code consumed and append the attempt ledger row.
   * Returns false when another request already consumed/revoked it.
   */
  claimCode(claim: RecoveryCodeClaim): Promise<boolean>;
  /** Failures within the lockout window for a user / active code-set / IP. */
  countRecentFailures(scope: RecoveryFailureScope): Promise<number>;
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
  // 1. Resolve the acknowledged code-set first. This does not expose code
  //    hashes, but it lets lockout accounting stay scoped to the current set
  //    instead of globally locking the user across all recovery lifecycles.
  const codeSetId = await store.getActiveCodeSetId(userId);
  if (!codeSetId) {
    await store.recordAttempt({
      userId,
      ipHash,
      codeSetId: null,
      succeeded: false,
    });
    return { ok: false, reason: 'invalid' };
  }

  // 2. Lockout check before loading/verifying recovery codes.
  const failureScope = { userId, ipHash, codeSetId };
  const failures = await store.countRecentFailures(failureScope);
  if (failures >= RECOVERY_MAX_FAILURES) {
    return { ok: false, reason: 'locked' };
  }

  // 3. Compute the candidate HMAC once, then compare against a padded active
  //    set without short-circuiting. The active set should contain exactly
  //    RECOVERY_CODE_COUNT rows; padding avoids making normal remaining-code
  //    counts observable through loop duration.
  const codes = await store.listActiveCodes(userId, codeSetId);
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
    await store.recordAttempt({
      userId,
      ipHash,
      codeSetId,
      succeeded: false,
    });
    return { ok: false, reason: 'invalid' };
  }

  // 4. Single-use: atomically claim the code and log the attempt in one
  //    database transaction. A false claim means another concurrent request
  //    consumed/revoked the matched code first.
  const claimed = await store.claimCode({
    ...failureScope,
    codeId: match.id,
  });
  if (!claimed) {
    return { ok: false, reason: 'invalid' };
  }

  return { ok: true, codeId: match.id };
}
