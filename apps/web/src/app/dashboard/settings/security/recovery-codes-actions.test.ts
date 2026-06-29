import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RECOVERY_CODE_COUNT } from '@/lib/auth/recovery-codes';

const {
  mockGetUser,
  mockEnsureActionRateLimit,
  mockGetRecoveryCodePepper,
  mockCreateCodeSet,
  mockAcknowledgeCodeSet,
  mockGetActiveCodeSetId,
  mockListActiveCodes,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockEnsureActionRateLimit: vi.fn(),
  mockGetRecoveryCodePepper: vi.fn(),
  mockCreateCodeSet: vi.fn(),
  mockAcknowledgeCodeSet: vi.fn(),
  mockGetActiveCodeSetId: vi.fn(),
  mockListActiveCodes: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve({ auth: { getUser: mockGetUser } }),
}));
vi.mock('@/lib/ensure-action-rate-limit', () => ({
  ensureActionRateLimit: mockEnsureActionRateLimit,
}));
vi.mock('@/env', () => ({
  getRecoveryCodePepper: mockGetRecoveryCodePepper,
}));
vi.mock('@/lib/auth/recovery-code-store', () => ({
  createRecoveryCodeStore: () => ({
    createCodeSet: mockCreateCodeSet,
    acknowledgeCodeSet: mockAcknowledgeCodeSet,
    getActiveCodeSetId: mockGetActiveCodeSetId,
    listActiveCodes: mockListActiveCodes,
  }),
}));

import {
  acknowledgeRecoveryCodesAction,
  generateRecoveryCodesAction,
  getRecoveryCodesStatusAction,
} from './recovery-codes-actions';

const UUID = '11111111-1111-4111-8111-111111111111';

describe('generateRecoveryCodesAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockEnsureActionRateLimit.mockResolvedValue(true);
    mockGetRecoveryCodePepper.mockReturnValue('x'.repeat(48));
    mockCreateCodeSet.mockResolvedValue('code-set-1');
  });

  it('refuses when the user is not signed in', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await generateRecoveryCodesAction();
    expect(result.ok).toBe(false);
    expect(mockCreateCodeSet).not.toHaveBeenCalled();
  });

  it('refuses when rate-limited', async () => {
    mockEnsureActionRateLimit.mockResolvedValueOnce(false);
    const result = await generateRecoveryCodesAction();
    expect(result.ok).toBe(false);
    expect(mockCreateCodeSet).not.toHaveBeenCalled();
  });

  it('returns a typed error when issuance throws', async () => {
    mockCreateCodeSet.mockRejectedValueOnce(new Error('db unavailable'));

    await expect(generateRecoveryCodesAction()).resolves.toEqual({
      ok: false,
      error: 'Could not generate recovery codes. Please try again.',
    });
  });

  it('generates a fresh pending set and returns the plaintext codes once', async () => {
    const result = await generateRecoveryCodesAction();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.codes).toHaveLength(RECOVERY_CODE_COUNT);
      expect(result.codeSetId).toBe('code-set-1');
    }
    expect(mockCreateCodeSet).toHaveBeenCalledTimes(1);
    const [userId, hashes] = mockCreateCodeSet.mock.calls[0];
    expect(userId).toBe('user-1');
    expect(hashes).toHaveLength(RECOVERY_CODE_COUNT);
  });
});

describe('acknowledgeRecoveryCodesAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockEnsureActionRateLimit.mockResolvedValue(true);
    mockAcknowledgeCodeSet.mockResolvedValue(true);
  });

  it('checks auth before UUID validation', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await acknowledgeRecoveryCodesAction('not-a-uuid');
    expect(result).toEqual({ ok: false, error: 'You must be signed in.' });
    expect(mockAcknowledgeCodeSet).not.toHaveBeenCalled();
  });

  it('rejects a non-uuid code set id without touching the store', async () => {
    const result = await acknowledgeRecoveryCodesAction('not-a-uuid');
    expect(result.ok).toBe(false);
    expect(mockAcknowledgeCodeSet).not.toHaveBeenCalled();
  });

  it('refuses when rate-limited', async () => {
    mockEnsureActionRateLimit.mockResolvedValueOnce(false);
    const result = await acknowledgeRecoveryCodesAction(UUID);
    expect(result.ok).toBe(false);
    expect(mockAcknowledgeCodeSet).not.toHaveBeenCalled();
  });

  it('rejects stale or random code set ids that the store will not acknowledge', async () => {
    mockAcknowledgeCodeSet.mockResolvedValueOnce(false);
    const result = await acknowledgeRecoveryCodesAction(UUID);
    expect(result).toEqual({
      ok: false,
      error: 'Invalid or expired code set.',
    });
  });

  it('returns a typed error when the acknowledgement store throws', async () => {
    mockAcknowledgeCodeSet.mockRejectedValueOnce(new Error('db unavailable'));
    const result = await acknowledgeRecoveryCodesAction(UUID);
    expect(result).toEqual({
      ok: false,
      error: 'Could not save recovery codes. Please try again.',
    });
  });

  it('acknowledges the code set for the signed-in user', async () => {
    const result = await acknowledgeRecoveryCodesAction(UUID);
    expect(result).toEqual({ ok: true });
    expect(mockAcknowledgeCodeSet).toHaveBeenCalledWith('user-1', UUID);
  });
});

describe('getRecoveryCodesStatusAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockGetActiveCodeSetId.mockResolvedValue('set-1');
  });

  it('returns 0 when the user is not signed in', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    expect(await getRecoveryCodesStatusAction()).toEqual({ count: 0 });
    expect(mockGetActiveCodeSetId).not.toHaveBeenCalled();
  });

  it('returns 0 when no code set is acknowledged', async () => {
    mockGetActiveCodeSetId.mockResolvedValueOnce(null);
    expect(await getRecoveryCodesStatusAction()).toEqual({ count: 0 });
    expect(mockListActiveCodes).not.toHaveBeenCalled();
  });

  it('returns 0 when the store throws', async () => {
    mockGetActiveCodeSetId.mockRejectedValueOnce(new Error('db unavailable'));
    expect(await getRecoveryCodesStatusAction()).toEqual({ count: 0 });
  });

  it('returns the number of active codes for the signed-in user', async () => {
    mockListActiveCodes.mockResolvedValueOnce([
      { id: 'a', codeHash: 'h1' },
      { id: 'b', codeHash: 'h2' },
      { id: 'c', codeHash: 'h3' },
    ]);
    expect(await getRecoveryCodesStatusAction()).toEqual({ count: 3 });
    expect(mockGetActiveCodeSetId).toHaveBeenCalledWith('user-1');
    expect(mockListActiveCodes).toHaveBeenCalledWith('user-1', 'set-1');
  });
});
