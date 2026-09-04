import { describe, expect, it, vi } from 'vitest';
import { resolveTrustedRepairPickupMismatchBinding } from './resolve-trusted-repair-pickup-mismatch-binding';

const merchantId = '123e4567-e89b-12d3-a456-426614174000';
const repairId = '223e4567-e89b-12d3-a456-426614174000';
const reference = 'RPU-ABC123DEF45678';

describe('resolveTrustedRepairPickupMismatchBinding', () => {
  it('uses signed claim merchant and repair ids when the claim exists', async () => {
    const from = vi.fn();
    const result = await resolveTrustedRepairPickupMismatchBinding({
      claim: { merchantId, repairId },
      reference,
      supabase: { from } as never,
    });

    expect(result).toEqual({
      kind: 'bound',
      merchantId,
      repairId,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('resolves merchant and repair from the trusted pending reference', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { repair_id: repairId, merchant_id: merchantId },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    const result = await resolveTrustedRepairPickupMismatchBinding({
      claim: null,
      reference,
      supabase: { from } as never,
    });

    expect(result).toEqual({
      kind: 'bound',
      merchantId,
      repairId,
    });
    expect(from).toHaveBeenCalledWith(
      'repair_pickup_pending_payment_references'
    );
    expect(select).toHaveBeenCalledWith('repair_id, merchant_id');
    expect(eq).toHaveBeenCalledWith('reference', reference);
  });

  it('returns orphan when no pending binding exists for the reference', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    const result = await resolveTrustedRepairPickupMismatchBinding({
      claim: null,
      reference,
      supabase: { from } as never,
    });

    expect(result).toEqual({ kind: 'orphan' });
  });

  it('returns lookup_failed when the pending-reference query errors', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'offline' },
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    try {
      const result = await resolveTrustedRepairPickupMismatchBinding({
        claim: null,
        reference,
        supabase: { from } as never,
      });
      expect(result).toEqual({ kind: 'lookup_failed' });
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
