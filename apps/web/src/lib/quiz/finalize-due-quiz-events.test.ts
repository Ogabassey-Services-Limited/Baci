import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  approved: vi.fn(() => true),
  phase: vi.fn(() => 'production'),
  rpc: vi.fn(),
}));

vi.mock('@/env', () => ({
  getQuizPhaseEnv: mocks.phase,
  getQuizProductionApprovedEnv: mocks.approved,
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));

import { finalizeDueQuizEvents } from './finalize-due-quiz-events';

describe('finalizeDueQuizEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.approved.mockReturnValue(true);
    mocks.phase.mockReturnValue('production');
    mocks.rpc.mockResolvedValue({ data: 0, error: null });
  });

  it('closes due product events before checking the production gate', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: 2, error: null });
    mocks.approved.mockImplementation(() => {
      expect(mocks.rpc).toHaveBeenCalledWith('close_due_product_quiz_events');
      return false;
    });

    await expect(finalizeDueQuizEvents()).resolves.toEqual({
      body: { closed: 2, finalized: 0, skipped: 'production_not_approved' },
      status: 200,
    });
  });

  it('does not finalize when production is unapproved', async () => {
    mocks.approved.mockReturnValue(false);
    mocks.rpc.mockResolvedValueOnce({ data: 2, error: null });

    await finalizeDueQuizEvents();

    expect(mocks.rpc).not.toHaveBeenCalledWith('finalize_due_quiz_events');
  });

  it('finalizes after the approved production gate', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: 2, error: null })
      .mockResolvedValueOnce({ data: 4, error: null });

    await expect(finalizeDueQuizEvents()).resolves.toEqual({
      body: { closed: 2, finalized: 4 },
      status: 200,
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(
      1,
      'close_due_product_quiz_events'
    );
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, 'finalize_due_quiz_events');
  });

  it('does not expose database errors in direct worker logs', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mocks.rpc
      .mockResolvedValueOnce({ data: 2, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'database-internal-detail' },
      });

    await finalizeDueQuizEvents();

    expect(consoleError).toHaveBeenCalledWith('Quiz finalize cron failed');
    expect(consoleError).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ message: 'database-internal-detail' })
    );
    consoleError.mockRestore();
  });
});
