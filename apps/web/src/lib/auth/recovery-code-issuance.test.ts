import { describe, expect, it, vi } from 'vitest';
import {
  issueRecoveryCodes,
  type RecoveryCodeIssuerStore,
} from './recovery-code-issuance';
import { hashRecoveryCode, RECOVERY_CODE_COUNT } from './recovery-codes';

const PEPPER = 'test-pepper';
const USER = 'user-1';

function makeStore() {
  const createCodeSet = vi.fn(
    (_userId: string, _hashes: string[]): Promise<string> =>
      Promise.resolve('code-set-1')
  );
  const store: RecoveryCodeIssuerStore = { createCodeSet };
  return { store, createCodeSet };
}

describe('issueRecoveryCodes', () => {
  it('returns the default number of plaintext codes plus the new code-set id', async () => {
    const { store } = makeStore();
    const result = await issueRecoveryCodes({
      userId: USER,
      pepper: PEPPER,
      store,
    });

    expect(result.codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(result.codeSetId).toBe('code-set-1');
  });

  it('persists hashes only — never plaintext codes', async () => {
    const { store, createCodeSet } = makeStore();
    const result = await issueRecoveryCodes({
      userId: USER,
      pepper: PEPPER,
      store,
    });

    expect(createCodeSet).toHaveBeenCalledTimes(1);
    const [userId, hashes] = createCodeSet.mock.calls[0];
    expect(userId).toBe(USER);
    expect(hashes).toHaveLength(RECOVERY_CODE_COUNT);
    // every stored value is an HMAC-SHA-256 hex digest, not a plaintext code
    for (const h of hashes) {
      expect(h).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(hashes).not.toContain(result.codes[0]);
  });

  it('stores a hash that verifies against each returned plaintext code', async () => {
    const { store, createCodeSet } = makeStore();
    const result = await issueRecoveryCodes({
      userId: USER,
      pepper: PEPPER,
      store,
    });

    const [, hashes] = createCodeSet.mock.calls[0];
    for (const code of result.codes) {
      expect(hashes).toContain(hashRecoveryCode(code, PEPPER));
    }
  });
});
