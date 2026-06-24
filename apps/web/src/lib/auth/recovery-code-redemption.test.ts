import { beforeEach, describe, expect, it } from 'vitest';
import {
  RECOVERY_MAX_FAILURES,
  type RecoveryCodeRecord,
  type RecoveryCodeStore,
  redeemRecoveryCode,
} from './recovery-code-redemption';
import { hashRecoveryCode } from './recovery-codes';

const PEPPER = 'test-pepper';
const USER = 'user-1';
const IP = 'ip-hash-1';
const CODE_SET_ID = 'set-1';

const FIXED_RECOVERY_CODES = [
  '0123-4567-89AB-CDEF-GHJK-MNPQ',
  'RSTV-WXYZ-0123-4567-89AB-CDEF',
  'GHJK-MNPQ-RSTV-WXYZ-0123-4567',
  '89AB-CDEF-GHJK-MNPQ-RSTV-WXYZ',
  '2345-6789-ABCD-EFGH-JKMQ-RSTV',
  'WXYZ-2345-6789-ABCD-EFGH-JKMQ',
  'CDEF-GHJK-MNPQ-RSTV-WXYZ-0123',
  'MNPQ-RSTV-WXYZ-0123-4567-89AB',
  '4567-89AB-CDEF-GHJK-MNPQ-RSTV',
  'WXYZ-RSTV-MNPQ-GHJK-CDEF-89AB',
] as const;
const UNKNOWN_RECOVERY_CODE = 'ZZZZ-YYYY-XXXX-WWWW-VVVV-TTTT';
const REPLACEMENT_CODE = 'ABCD-EFGH-JKMQ-RSTV-WXYZ-2345';

type Attempt = {
  userId: string;
  ipHash: string;
  codeSetId: string | null;
  succeeded: boolean;
};

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
    activeCodeCount: () => number;
    listCalls: () => number;
    isUsed: (id: string) => boolean;
  } = {
    getActiveCodeSetId: (): Promise<string | null> =>
      Promise.resolve(CODE_SET_ID),
    listActiveCodes: (): Promise<RecoveryCodeRecord[]> => {
      listCalls += 1;
      return Promise.resolve(
        codes
          .filter((c) => !c.used)
          .map(({ id, codeHash }) => ({ id, codeHash }))
      );
    },
    beginAttempt: ({
      codeSetId,
      ipHash,
      maxFailures,
      userId,
    }): Promise<string | null> => {
      if (
        attempts.filter(
          (attempt) =>
            !attempt.succeeded &&
            attempt.userId === userId &&
            attempt.codeSetId === codeSetId &&
            attempt.ipHash === ipHash
        ).length >= maxFailures
      ) {
        return Promise.resolve(null);
      }
      attempts.push({
        userId,
        ipHash,
        codeSetId,
        succeeded: false,
      });
      return Promise.resolve(String(attempts.length - 1));
    },
    claimCode: ({
      attemptId,
      codeId,
      codeSetId,
      replacementCodeHash,
    }: {
      attemptId: string;
      codeId: string;
      codeSetId: string;
      replacementCodeHash: string;
    }): Promise<boolean> => {
      if (codeSetId !== CODE_SET_ID) {
        return Promise.resolve(false);
      }
      const c = codes.find((x) => x.id === codeId);
      if (!c || c.used) {
        attempts.push({
          userId: USER,
          ipHash: IP,
          codeSetId,
          succeeded: false,
        });
        return Promise.resolve(false);
      }
      c.used = true;
      attempts[Number(attemptId)].succeeded = true;
      codes.push({
        id: `replacement-${codes.length}`,
        codeHash: replacementCodeHash,
        used: false,
      });
      return Promise.resolve(true);
    },
    recordAttempt: (a: Attempt): Promise<void> => {
      attempts.push(a);
      return Promise.resolve();
    },
    attempts,
    activeCodeCount: () => codes.filter((c) => !c.used).length,
    listCalls: () => listCalls,
    isUsed: (id: string) => codes.find((x) => x.id === id)?.used ?? false,
  };
  return store;
}

function redeem(
  store: RecoveryCodeStore,
  input: string,
  overrides: Partial<Parameters<typeof redeemRecoveryCode>[0]> = {}
) {
  return redeemRecoveryCode({
    userId: USER,
    ipHash: IP,
    input,
    pepper: PEPPER,
    store,
    generateReplacementCode: () => REPLACEMENT_CODE,
    ...overrides,
  });
}

describe('redeemRecoveryCode', () => {
  let codes: string[];
  beforeEach(() => {
    codes = [...FIXED_RECOVERY_CODES];
  });

  it('accepts a valid code, consumes it, and records success', async () => {
    const store = makeStore(codes);
    const result = await redeem(store, codes[3]);

    expect(result).toEqual({
      ok: true,
      codeId: 'code-3',
      replacementCode: REPLACEMENT_CODE,
    });
    expect(store.isUsed('code-3')).toBe(true);
    expect(store.activeCodeCount()).toBe(FIXED_RECOVERY_CODES.length);
    expect(store.attempts.at(-1)).toEqual({
      userId: USER,
      ipHash: IP,
      codeSetId: CODE_SET_ID,
      succeeded: true,
    });
  });

  it('matches a code regardless of formatting/case', async () => {
    const store = makeStore(codes);
    const result = await redeem(
      store,
      codes[0].toLowerCase().replace(/-/g, ' ')
    );
    expect(result.ok).toBe(true);
  });

  it('rejects an unknown code and records a failure', async () => {
    const store = makeStore(codes);
    const result = await redeem(store, UNKNOWN_RECOVERY_CODE);

    expect(result).toEqual({ ok: false, reason: 'invalid' });
    expect(store.attempts).toHaveLength(1);
    expect(store.attempts[0]).toEqual({
      userId: USER,
      ipHash: IP,
      codeSetId: CODE_SET_ID,
      succeeded: false,
    });
  });

  it('does not accept an already-consumed code', async () => {
    const store = makeStore(codes);
    await redeem(store, codes[2]);
    const second = await redeem(store, codes[2]);
    expect(second).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects a valid match when another request consumed it first', async () => {
    const store = makeStore(codes);
    store.claimCode = () => Promise.resolve(false);

    const result = await redeem(store, codes[1]);

    expect(result).toEqual({ ok: false, reason: 'invalid' });
    expect(store.attempts.at(-1)).toEqual({
      userId: USER,
      ipHash: IP,
      codeSetId: CODE_SET_ID,
      succeeded: false,
    });
  });

  it('locks out before verifying once failures reach the threshold', async () => {
    const store = makeStore(codes);
    for (let i = 0; i < RECOVERY_MAX_FAILURES; i += 1) {
      store.attempts.push({
        userId: USER,
        ipHash: IP,
        codeSetId: CODE_SET_ID,
        succeeded: false,
      });
    }
    const callsBefore = store.listCalls();

    const result = await redeem(store, codes[0]); // valid code refused while locked

    expect(result).toEqual({ ok: false, reason: 'locked' });
    expect(store.listCalls()).toBe(callsBefore); // did not even look up codes
    expect(store.isUsed('code-0')).toBe(false); // valid code preserved
  });

  it('eventually locks after repeated wrong codes (no-match attempts count)', async () => {
    const store = makeStore(codes);
    for (let i = 0; i < RECOVERY_MAX_FAILURES; i += 1) {
      await redeem(store, UNKNOWN_RECOVERY_CODE);
    }
    const result = await redeem(store, codes[0]);
    expect(result).toEqual({ ok: false, reason: 'locked' });
  });

  it('fails closed when the user has no acknowledged active code set', async () => {
    const store = makeStore(codes);
    store.getActiveCodeSetId = () => Promise.resolve(null);

    const result = await redeem(store, codes[0]);

    expect(result).toEqual({ ok: false, reason: 'invalid' });
    expect(store.listCalls()).toBe(0);
    expect(store.attempts.at(-1)).toEqual({
      userId: USER,
      ipHash: IP,
      codeSetId: null,
      succeeded: false,
    });
  });
});
