import { generateRecoveryCodes, hashRecoveryCode } from './recovery-codes';

/**
 * Issuing (generating) a merchant's recovery-code set. Pure orchestration so it
 * can be unit-tested against a fake store; the Supabase-backed `createCodeSet`
 * persists a PENDING set only — the previous set stays active and is revoked
 * later, in `acknowledge_recovery_code_set()`, once the merchant confirms they
 * saved the new codes.
 */
export interface RecoveryCodeIssuerStore {
  /** Persist a pending new code set and return its id. */
  createCodeSet(userId: string, codeHashes: string[]): Promise<string>;
}

type IssueParams = {
  userId: string;
  pepper: string;
  store: RecoveryCodeIssuerStore;
};

/**
 * Generates a fresh recovery-code set, persists only the HMAC hashes, and
 * returns the plaintext codes to show the merchant ONCE (never stored). The
 * previously acknowledged set stays active until this set is acknowledged.
 */
export async function issueRecoveryCodes({
  userId,
  pepper,
  store,
}: IssueParams): Promise<{ codes: string[]; codeSetId: string }> {
  const codes = generateRecoveryCodes();
  const codeHashes = codes.map((code) => hashRecoveryCode(code, pepper));
  const codeSetId = await store.createCodeSet(userId, codeHashes);
  return { codes, codeSetId };
}
