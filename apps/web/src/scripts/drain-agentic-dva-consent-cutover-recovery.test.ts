import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { finalizeAgenticCheckoutPayment } from '@/lib/agentic/checkout-completion-finalize';
import { reserveAgenticIdempotencyKey } from '@/lib/agentic/idempotency';
import { logger } from '@/lib/logger';
import { runDrainAgenticDvaConsentCutoverCli } from './drain-agentic-dva-consent-cutover';
import { drainAgenticDvaTestSupport } from './drain-agentic-dva-consent-cutover.test-support';

vi.mock('@/lib/agentic/checkout-completion-finalize', () => ({
  finalizeAgenticCheckoutPayment: vi.fn(),
}));
vi.mock('@/lib/agentic/idempotency', () => ({
  reserveAgenticIdempotencyKey: vi.fn(),
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

const { accountReadyRow, argsFor, createSupabase, now } =
  drainAgenticDvaTestSupport;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('runDrainAgenticDvaConsentCutoverCli recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubEnv('AGENTIC_PAYSTACK_DVA_MODE', 'paused');
    vi.mocked(reserveAgenticIdempotencyKey).mockResolvedValue({
      ok: true,
      state: 'reserved',
    });
    vi.mocked(finalizeAgenticCheckoutPayment).mockResolvedValue(
      new Response(null, { status: 200 }) as never
    );
  });

  it('returns failure when finalization returns a non-success response', async () => {
    vi.mocked(finalizeAgenticCheckoutPayment).mockResolvedValue(
      new Response(null, { status: 500 }) as never
    );
    const row = accountReadyRow();
    const { supabase } = createSupabase(row);

    await expect(
      runDrainAgenticDvaConsentCutoverCli(
        [...argsFor(row, 'payment_account_ready'), '--apply'],
        supabase as never,
        now
      )
    ).resolves.toBe(1);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('500'));
  });

  it('fails closed when finalization throws unexpectedly', async () => {
    vi.mocked(finalizeAgenticCheckoutPayment).mockRejectedValue(
      new Error('secret provider detail')
    );
    const row = accountReadyRow();
    const { supabase } = createSupabase(row);

    await expect(
      runDrainAgenticDvaConsentCutoverCli(
        [...argsFor(row, 'payment_account_ready'), '--apply'],
        supabase as never,
        now
      )
    ).resolves.toBe(1);
    expect(console.log).not.toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      'secret provider detail'
    );
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain(
      'secret provider detail'
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        finalizerErrorType: 'Error',
        reason: 'finalizer_threw',
      })
    );
  });

  it('reuses the exact stored claim for order-finalizing recovery', async () => {
    const row = accountReadyRow();
    const agentic = (row.metadata as { agentic: Record<string, unknown> })
      .agentic;
    row.metadata = {
      agentic: {
        ...agentic,
        finalization_claim: `agentic_order_${'a'.repeat(64)}`,
        finalization_order_id: 'order-1',
        payment_state: 'order_finalizing',
      },
    };
    const { supabase } = createSupabase(row);

    await expect(
      runDrainAgenticDvaConsentCutoverCli(
        [...argsFor(row, 'order_finalizing'), '--apply'],
        supabase as never,
        now
      )
    ).resolves.toBe(0);

    expect(finalizeAgenticCheckoutPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        finalizationClaimOverride: `agentic_order_${'a'.repeat(64)}`,
      })
    );
  });

  it('blocks malformed account evidence before idempotency or finalization', async () => {
    const row = accountReadyRow();
    row.virtual_account_number = '9999999999';
    const { supabase } = createSupabase(row);

    await expect(
      runDrainAgenticDvaConsentCutoverCli(
        [...argsFor(row, 'payment_account_ready'), '--apply'],
        supabase as never,
        now
      )
    ).resolves.toBe(1);
    expect(reserveAgenticIdempotencyKey).not.toHaveBeenCalled();
    expect(finalizeAgenticCheckoutPayment).not.toHaveBeenCalled();
  });
});
