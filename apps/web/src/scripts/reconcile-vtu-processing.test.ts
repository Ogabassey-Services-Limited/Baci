import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  reconcileProcessingVtuTransactions: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock('@/lib/vtu-processing-reconciliation', () => ({
  reconcileProcessingVtuTransactions: mocks.reconcileProcessingVtuTransactions,
}));

import { runReconcileVtuProcessingCli } from './reconcile-vtu-processing';

describe('runReconcileVtuProcessingCli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs VTU reconciliation directly with the service client', async () => {
    const supabase = { service: true };
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mocks.createServiceClient.mockReturnValue(supabase);
    mocks.reconcileProcessingVtuTransactions.mockResolvedValue({
      checked: 2,
      errored: 0,
      errors: [],
      failed: 1,
      processing: 0,
      successful: 1,
    });

    const exitCode = await runReconcileVtuProcessingCli();

    expect(exitCode).toBe(0);
    expect(mocks.reconcileProcessingVtuTransactions).toHaveBeenCalledWith({
      supabase,
    });
    expect(JSON.parse(logSpy.mock.calls[0]?.[0] ?? '{}')).toMatchObject({
      checked: 2,
      errored: 0,
      failed: 1,
      processing: 0,
      successful: 1,
    });
  });

  it('returns non-zero when reconciliation records worker errors', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mocks.createServiceClient.mockReturnValue({ service: true });
    mocks.reconcileProcessingVtuTransactions.mockResolvedValue({
      checked: 1,
      errored: 1,
      errors: [{ message: 'provider timeout', transactionId: 'txn-1' }],
      failed: 0,
      processing: 0,
      successful: 0,
    });

    const exitCode = await runReconcileVtuProcessingCli();

    expect(exitCode).toBe(1);
    expect(JSON.parse(logSpy.mock.calls[0]?.[0] ?? '{}')).toMatchObject({
      errored: 1,
      errors: [{ message: 'provider timeout', transactionId: 'txn-1' }],
    });
  });
});
