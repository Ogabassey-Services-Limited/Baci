import { describe, expect, it } from 'vitest';
import { classifyRpcErrorReason } from './storefront-preflight-rpc-error';

describe('classifyRpcErrorReason', () => {
  it.each([
    // Postgres statement_timeout — the anon role's DB-side cap.
    [
      'a 57014 statement timeout',
      { code: '57014', message: 'canceling statement' },
      'timeout',
    ],
    // Abort-like: the per-call abort signal fired, or a DOMException leaked.
    [
      'an abort message',
      { code: '', message: 'The operation was aborted' },
      'timeout',
    ],
    [
      'an AbortError name',
      { code: '', message: 'x', name: 'AbortError' },
      'timeout',
    ],
    [
      'a TimeoutError name',
      { code: '', message: 'x', name: 'TimeoutError' },
      'timeout',
    ],
    ['an AbortError code', { code: 'AbortError', message: 'x' }, 'timeout'],
    // Network-like: flattened transport failures (empty code).
    [
      'an empty-code fetch failure',
      { code: '', message: 'fetch failed' },
      'fetch-error',
    ],
    [
      'a network message',
      { code: '', message: 'network request failed' },
      'fetch-error',
    ],
    [
      'an ECONNRESET message',
      { code: '', message: 'read ECONNRESET' },
      'fetch-error',
    ],
    [
      'an ETIMEDOUT message',
      { code: '', message: 'connect ETIMEDOUT' },
      'fetch-error',
    ],
    [
      'a socket hang up message',
      { code: '', message: 'socket hang up' },
      'fetch-error',
    ],
    // Genuine PostgREST / SQLSTATE codes stay has-error.
    [
      'a PostgREST missing-fn code',
      { code: 'PGRST202', message: 'no fn' },
      'has-error',
    ],
    [
      'a SQLSTATE application error',
      { code: 'XX000', message: 'boom' },
      'has-error',
    ],
    // A coded DB error whose message mentions "abort" is NOT a transport abort
    // (e.g. SQLSTATE 25P02) — the non-empty code keeps it has-error.
    [
      'a coded transaction-aborted SQLSTATE',
      {
        code: '25P02',
        message: 'current transaction is aborted, commands ignored',
      },
      'has-error',
    ],
  ] as const)('classifies %s as %s', (_label, error, expected) => {
    expect(classifyRpcErrorReason(error)).toBe(expected);
  });

  it('defaults to has-error for an empty error object', () => {
    expect(classifyRpcErrorReason({})).toBe('has-error');
  });
});
