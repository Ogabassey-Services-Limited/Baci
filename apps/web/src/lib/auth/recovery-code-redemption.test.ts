import { beforeEach, describe, expect, it } from 'vitest';
import {
  RECOVERY_MAX_FAILURES,
  type RecoveryCodeRecord,
  type RecoveryCodeStore,
  redeemRecoveryCode,
} from './recovery-code-redemption';
import { generateRecoveryCodes, hashRecoveryCode } from './recovery-codes';

const PEPPER = 'test-pepper';
const USER = 'user-1';
const IP = 'ip-hash-1';

type Attempt = { userId: string; ipHash: string; succeeded: boolean };

function makeStore(plaintextCodes: string[]) {
  const codes = plaintextCodes.map((code, i) => ({
    id: `code-${i}`,
    codeHash: hashRecoveryCode(code, PEPPER),
    used: false,
  }));
  const attempts: Attempt[] = [];
  let listCalls = 0;

  const store: RecoveryCodeStore & {
    attempts: Attempt[];
    listCalls: () => number;
    isUsed: (id: string) => boolean;
  } = {
    listActiveCodes: (): Promise<RecoveryCodeRecord[]> => {
      listCalls += 1;
      return Promise.resolve(
        codes
          .filter((c) => !c.used)
          .map(({ id, codeHash }) => ({ id, codeHash }))
      );
    },
    markCodeUsed: (id: string): Promise<boolean> => {
      const c = codes.find((x) => x.id === id);
      if (!c || c.used) {
        return Promise.resolve(false);
      }
      c.used = true;
      return Promise.resolve(true);
    },
    countRecentFailures: (): Promise<number> =>
      Promise.resolve(attempts.filter((a) => !a.succeeded).length),
    recordAttempt: (a: Attempt): Promise<void> => {
      attempts.push(a);
      return Promise.resolve();
    },
    attempts,
    listCalls: () => listCalls,
    isUsed: (id: string) => codes.find((x) => x.id === id)?.used ?? false,
  };
  return store;
}

describe('redeemRecoveryCode', () => {
  let codes: string[];
  beforeEach(() => {
    codes = generateRecoveryCodes();
  });

  it('accepts a valid code, consumes it, and records success', async () => {
    const store = makeStore(codes);
    const result = await redeemRecoveryCode({
      userId: USER,
      ipHash: IP,
      input: codes[3],
      pepper: PEPPER,
      store,
    });

    expect(result).toEqual({ ok: true, codeId: 'code-3' });
    expect(store.isUsed('code-3')).toBe(true);
    expect(store.attempts.at(-1)).toEqual({
      userId: USER,
      ipHash: IP,
      succeeded: true,
    });
  });

  it('matches a code regardless of formatting/case', async () => {
    const store = makeStore(codes);
    const result = await redeemRecoveryCode({
      userId: USER,
      ipHash: IP,
      input: codes[0].toLowerCase().replace(/-/g, ' '),
      pepper: PEPPER,
      store,
    });
    expect(result.ok).toBe(true);
  });

  it('rejects an unknown code and records a failure', async () => {
    const store = makeStore(codes);
    const [other] = generateRecoveryCodes(1);
    const result = await redeemRecoveryCode({
      userId: USER,
      ipHash: IP,
      input: other,
      pepper: PEPPER,
      store,
    });

    expect(result).toEqual({ ok: false, reason: 'invalid' });
    expect(store.attempts).toHaveLength(1);
    expect(store.attempts[0].succeeded).toBe(false);
  });

  it('does not accept an already-consumed code', async () => {
    const store = makeStore(codes);
    await redeemRecoveryCode({
      userId: USER,
      ipHash: IP,
      input: codes[2],
      pepper: PEPPER,
      store,
    });
    const second = await redeemRecoveryCode({
      userId: USER,
      ipHash: IP,
      input: codes[2],
      pepper: PEPPER,
      store,
    });
    expect(second).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects a valid match when another request consumed it first', async () => {
    const store = makeStore(codes);
    const originalMarkCodeUsed = store.markCodeUsed;
    store.markCodeUsed = async (id: string) => {
      await originalMarkCodeUsed(id);
      return false;
    };

    const result = await redeemRecoveryCode({
      userId: USER,
      ipHash: IP,
      input: codes[1],
      pepper: PEPPER,
      store,
    });

    expect(result).toEqual({ ok: false, reason: 'invalid' });
    expect(store.attempts.at(-1)).toEqual({
      userId: USER,
      ipHash: IP,
      succeeded: false,
    });
  });

  it('locks out before verifying once failures reach the threshold', async () => {
    const store = makeStore(codes);
    for (let i = 0; i < RECOVERY_MAX_FAILURES; i += 1) {
      store.attempts.push({ userId: USER, ipHash: IP, succeeded: false });
    }
    const callsBefore = store.listCalls();

    const result = await redeemRecoveryCode({
      userId: USER,
      ipHash: IP,
      input: codes[0], // a valid code — must still be refused while locked
      pepper: PEPPER,
      store,
    });

    expect(result).toEqual({ ok: false, reason: 'locked' });
    expect(store.listCalls()).toBe(callsBefore); // did not even look up codes
    expect(store.isUsed('code-0')).toBe(false); // valid code preserved
  });

  it('eventually locks after repeated wrong codes (no-match attempts count)', async () => {
    const store = makeStore(codes);
    const [wrong] = generateRecoveryCodes(1);
    for (let i = 0; i < RECOVERY_MAX_FAILURES; i += 1) {
      await redeemRecoveryCode({
        userId: USER,
        ipHash: IP,
        input: wrong,
        pepper: PEPPER,
        store,
      });
    }
    const result = await redeemRecoveryCode({
      userId: USER,
      ipHash: IP,
      input: codes[0],
      pepper: PEPPER,
      store,
    });
    expect(result).toEqual({ ok: false, reason: 'locked' });
  });
});
