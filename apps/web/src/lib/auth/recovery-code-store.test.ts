import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createClient: () => ({ from: mockFrom, rpc: mockRpc }),
}));

import { createRecoveryCodeStore } from './recovery-code-store';

type Result = { data?: unknown; error?: unknown; count?: number | null };
type Spy = ReturnType<typeof vi.fn>;
type Builder = {
  select: Spy;
  update: Spy;
  insert: Spy;
  eq: Spy;
  is: Spy;
  gte: Spy;
  maybeSingle: Spy;
  then: (resolve: (r: Result) => void) => void;
};

function queryReturning(result: Result): Builder {
  const builder = {} as Builder;
  const ret = () => builder;
  builder.select = vi.fn(ret);
  builder.update = vi.fn(ret);
  builder.insert = vi.fn(ret);
  builder.eq = vi.fn(ret);
  builder.is = vi.fn(ret);
  builder.gte = vi.fn(ret);
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  // biome-ignore lint/suspicious/noThenProperty: intentional thenable to mock the awaitable Supabase query builder
  builder.then = (resolve) => resolve(result);
  return builder;
}

describe('recovery-code-store (Supabase-backed)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getActiveCodeSetId returns the acknowledged code set', async () => {
    const readinessBuilder = queryReturning({
      data: { acknowledged_code_set_id: 'set-1' },
      error: null,
    });
    mockFrom.mockReturnValueOnce(readinessBuilder);

    await expect(
      createRecoveryCodeStore().getActiveCodeSetId('user-1')
    ).resolves.toBe('set-1');

    expect(mockFrom).toHaveBeenCalledWith('merchant_auth_readiness');
    expect(readinessBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('getActiveCodeSetId returns null when no set is acknowledged', async () => {
    mockFrom.mockReturnValueOnce(
      queryReturning({ data: { acknowledged_code_set_id: null }, error: null })
    );

    await expect(
      createRecoveryCodeStore().getActiveCodeSetId('u')
    ).resolves.toBeNull();
  });

  it('getActiveCodeSetId throws on a readiness query error (fail closed)', async () => {
    mockFrom.mockReturnValueOnce(
      queryReturning({ data: null, error: { message: 'boom' } })
    );
    await expect(
      createRecoveryCodeStore().getActiveCodeSetId('u')
    ).rejects.toThrow('Failed to load recovery readiness');
  });

  it('listActiveCodes returns unused, non-revoked codes mapped to records', async () => {
    const codesBuilder = queryReturning({
      data: [
        { id: 'c1', code_hash: 'h1' },
        { id: 'c2', code_hash: 'h2' },
      ],
      error: null,
    });
    mockFrom.mockReturnValueOnce(codesBuilder);

    const codes = await createRecoveryCodeStore().listActiveCodes(
      'user-1',
      'set-1'
    );

    expect(mockFrom).toHaveBeenCalledWith('merchant_auth_recovery_codes');
    expect(codesBuilder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(codesBuilder.eq).toHaveBeenCalledWith('code_set_id', 'set-1');
    expect(codesBuilder.is).toHaveBeenCalledWith('used_at', null);
    expect(codesBuilder.is).toHaveBeenCalledWith('revoked_at', null);
    expect(codes).toEqual([
      { id: 'c1', codeHash: 'h1' },
      { id: 'c2', codeHash: 'h2' },
    ]);
  });

  it('listActiveCodes throws on a codes query error (fail closed)', async () => {
    mockFrom.mockReturnValueOnce(
      queryReturning({ data: null, error: { message: 'boom' } })
    );
    await expect(
      createRecoveryCodeStore().listActiveCodes('u', 'set-1')
    ).rejects.toThrow('Failed to load recovery codes');
  });

  it('claimCode returns true after atomically claiming and logging an unused code', async () => {
    mockRpc.mockResolvedValueOnce({ data: true, error: null });

    const claimed = await createRecoveryCodeStore().claimCode({
      userId: 'user-1',
      codeSetId: 'set-1',
      codeId: 'c1',
      ipHash: 'ip',
      attemptId: 'attempt-1',
    });

    expect(claimed).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('claim_merchant_auth_recovery_code', {
      p_attempt_id: 'attempt-1',
      p_code_id: 'c1',
      p_code_set_id: 'set-1',
      p_ip_hash: 'ip',
      p_user_id: 'user-1',
    });
  });

  it('claimCode throws on query error (fail closed)', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'denied' } });

    await expect(
      createRecoveryCodeStore().claimCode({
        userId: 'user-1',
        codeSetId: 'set-1',
        codeId: 'c1',
        ipHash: 'ip',
        attemptId: 'attempt-1',
      })
    ).rejects.toThrow('Failed to consume recovery code');
  });

  it('claimCode returns false when no unused row was claimed', async () => {
    mockRpc.mockResolvedValueOnce({ data: false, error: null });

    await expect(
      createRecoveryCodeStore().claimCode({
        userId: 'user-1',
        codeSetId: 'set-1',
        codeId: 'c1',
        ipHash: 'ip',
        attemptId: 'attempt-1',
      })
    ).resolves.toBe(false);
  });

  it('beginAttempt returns the reserved attempt id when below lockout threshold', async () => {
    mockRpc.mockResolvedValueOnce({ data: 'attempt-1', error: null });

    await expect(
      createRecoveryCodeStore().beginAttempt({
        userId: 'user-1',
        codeSetId: 'set-1',
        ipHash: 'ip',
        maxFailures: 10,
      })
    ).resolves.toBe('attempt-1');

    expect(mockRpc).toHaveBeenCalledWith(
      'begin_merchant_auth_recovery_attempt',
      {
        p_code_set_id: 'set-1',
        p_cutoff: expect.any(String),
        p_ip_hash: 'ip',
        p_max_failures: 10,
        p_user_id: 'user-1',
      }
    );
  });

  it('beginAttempt returns null when the tuple is already locked', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      createRecoveryCodeStore().beginAttempt({
        userId: 'user-1',
        codeSetId: 'set-1',
        ipHash: 'ip',
        maxFailures: 10,
      })
    ).resolves.toBeNull();
  });

  it('beginAttempt throws on RPC error (fail closed)', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'lock denied' },
    });

    await expect(
      createRecoveryCodeStore().beginAttempt({
        userId: 'user-1',
        codeSetId: 'set-1',
        ipHash: 'ip',
        maxFailures: 10,
      })
    ).rejects.toThrow('Failed to begin recovery attempt');
  });

  it('countRecentFailures throws on query error (fail closed)', async () => {
    mockFrom.mockReturnValueOnce(
      queryReturning({ count: null, error: { message: 'count denied' } })
    );

    await expect(
      createRecoveryCodeStore().countRecentFailures({
        userId: 'user-1',
        codeSetId: 'set-1',
        ipHash: 'ip',
      })
    ).rejects.toThrow('Failed to count recovery attempts');
  });

  it('countRecentFailures counts failed attempts within the window', async () => {
    const builder = queryReturning({ count: 3, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const n = await createRecoveryCodeStore().countRecentFailures({
      userId: 'user-1',
      codeSetId: 'set-1',
      ipHash: 'ip',
    });

    expect(mockFrom).toHaveBeenCalledWith('merchant_auth_recovery_attempts');
    expect(builder.select).toHaveBeenCalledWith('id', {
      count: 'exact',
      head: true,
    });
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builder.eq).toHaveBeenCalledWith('code_set_id', 'set-1');
    expect(builder.eq).toHaveBeenCalledWith('ip_hash', 'ip');
    expect(builder.eq).toHaveBeenCalledWith('succeeded', false);
    expect(builder.gte).toHaveBeenCalledWith('created_at', expect.any(String));
    expect(n).toBe(3);
  });

  it('countRecentFailures treats a null count as 0', async () => {
    mockFrom.mockReturnValueOnce(queryReturning({ count: null, error: null }));
    expect(
      await createRecoveryCodeStore().countRecentFailures({
        userId: 'u',
        codeSetId: 'set-1',
        ipHash: 'ip',
      })
    ).toBe(0);
  });

  it('recordAttempt inserts an attempt row', async () => {
    const builder = queryReturning({ data: null, error: null });
    mockFrom.mockReturnValueOnce(builder);

    await createRecoveryCodeStore().recordAttempt({
      userId: 'user-1',
      ipHash: 'ip',
      codeSetId: 'set-1',
      succeeded: false,
    });

    expect(mockFrom).toHaveBeenCalledWith('merchant_auth_recovery_attempts');
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        ip_hash: 'ip',
        code_set_id: 'set-1',
        succeeded: false,
      })
    );
  });

  it('recordAttempt throws on error', async () => {
    mockFrom.mockReturnValueOnce(
      queryReturning({ data: null, error: { message: 'x' } })
    );
    await expect(
      createRecoveryCodeStore().recordAttempt({
        userId: 'u',
        ipHash: 'i',
        codeSetId: null,
        succeeded: true,
      })
    ).rejects.toThrow();
  });
});
