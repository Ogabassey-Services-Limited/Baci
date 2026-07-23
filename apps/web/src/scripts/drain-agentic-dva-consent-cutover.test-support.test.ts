import { describe, expect, it } from 'vitest';
import { drainAgenticDvaTestSupport } from './drain-agentic-dva-consent-cutover.test-support';

describe('drainAgenticDvaTestSupport', () => {
  it('provides chainable read and update mocks with configured results', async () => {
    const row = drainAgenticDvaTestSupport.claimingRow();
    const updateResult = { data: { session_id: row.session_id }, error: null };
    const { supabase, update, updateChain } =
      drainAgenticDvaTestSupport.createSupabase(row, updateResult);

    const table = supabase.from('checkout_sessions');
    const readChain = table.select('session_id');
    expect(readChain.eq('session_id', row.session_id)).toBe(readChain);
    await expect(readChain.maybeSingle()).resolves.toEqual({
      data: row,
      error: null,
    });

    const mutation = table.update({ payment_reference: null });
    expect(mutation.eq('session_id', row.session_id)).toBe(mutation);
    expect(mutation.is('order_id', null)).toBe(mutation);
    expect(mutation.contains('metadata', {})).toBe(mutation);
    await expect(mutation.select('session_id').maybeSingle()).resolves.toEqual(
      updateResult
    );
    expect(update).toHaveBeenCalledOnce();
    expect(updateChain.select).toHaveBeenCalledWith('session_id');

    const updateError = { code: 'PGRST000', message: 'update failed' };
    const errorResult = { data: null, error: updateError };
    const { supabase: errorSupabase } =
      drainAgenticDvaTestSupport.createSupabase(row, errorResult);
    await expect(
      errorSupabase
        .from('checkout_sessions')
        .update({ payment_reference: null })
        .select('session_id')
        .maybeSingle()
    ).resolves.toEqual(errorResult);
  });
});
