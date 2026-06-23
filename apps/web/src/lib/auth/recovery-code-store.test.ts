import { describe, expect, it, vi } from 'vitest';

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
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
  // biome-ignore lint/suspicious/noThenProperty: intentional thenable to mock the awaitable Supabase query builder
  builder.then = (resolve) => resolve(result);
  return builder;
}

describe('recovery-code-store (Supabase-backed)', () => {
  it('listActiveCodes returns unused, non-revoked codes mapped to records', async () => {
    const builder = queryReturning({
      data: [
        { id: 'c1', code_hash: 'h1' },
        { id: 'c2', code_hash: 'h2' },
      ],
      error: null,
    });
    mockFrom.mockReturnValueOnce(builder);

    const codes = await createRecoveryCodeStore().listActiveCodes('user-1');

    expect(mockFrom).toHaveBeenCalledWith('merchant_auth_recovery_codes');
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builder.is).toHaveBeenCalledWith('used_at', null);
    expect(builder.is).toHaveBeenCalledWith('revoked_at', null);
    expect(codes).toEqual([
      { id: 'c1', codeHash: 'h1' },
      { id: 'c2', codeHash: 'h2' },
    ]);
  });

  it('listActiveCodes throws on a query error (fail closed)', async () => {
    mockFrom.mockReturnValueOnce(
      queryReturning({ data: null, error: { message: 'boom' } })
    );
    await expect(
      createRecoveryCodeStore().listActiveCodes('u')
    ).rejects.toThrow();
  });

  it('markCodeUsed returns true after atomically claiming an unused code', async () => {
    const builder = queryReturning({ data: [{ id: 'c1' }], error: null });
    mockFrom.mockReturnValueOnce(builder);

    const claimed = await createRecoveryCodeStore().markCodeUsed('c1');

    expect(claimed).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('merchant_auth_recovery_codes');
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ used_at: expect.any(String) })
    );
    expect(builder.eq).toHaveBeenCalledWith('id', 'c1');
    expect(builder.is).toHaveBeenCalledWith('used_at', null);
    expect(builder.select).toHaveBeenCalledWith('id');
  });

  it('markCodeUsed returns false when no unused row was claimed', async () => {
    mockFrom.mockReturnValueOnce(queryReturning({ data: [], error: null }));

    await expect(createRecoveryCodeStore().markCodeUsed('c1')).resolves.toBe(
      false
    );
  });

  it('countRecentFailures counts failed attempts within the window', async () => {
    const builder = queryReturning({ count: 3, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const n = await createRecoveryCodeStore().countRecentFailures('user-1');

    expect(mockFrom).toHaveBeenCalledWith('merchant_auth_recovery_attempts');
    expect(builder.select).toHaveBeenCalledWith('id', {
      count: 'exact',
      head: true,
    });
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builder.eq).toHaveBeenCalledWith('succeeded', false);
    expect(builder.gte).toHaveBeenCalledWith('created_at', expect.any(String));
    expect(n).toBe(3);
  });

  it('countRecentFailures treats a null count as 0', async () => {
    mockFrom.mockReturnValueOnce(queryReturning({ count: null, error: null }));
    expect(await createRecoveryCodeStore().countRecentFailures('u')).toBe(0);
  });

  it('recordAttempt inserts an attempt row', async () => {
    const builder = queryReturning({ data: null, error: null });
    mockFrom.mockReturnValueOnce(builder);

    await createRecoveryCodeStore().recordAttempt({
      userId: 'user-1',
      ipHash: 'ip',
      succeeded: false,
    });

    expect(mockFrom).toHaveBeenCalledWith('merchant_auth_recovery_attempts');
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        ip_hash: 'ip',
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
        succeeded: true,
      })
    ).rejects.toThrow();
  });
});
