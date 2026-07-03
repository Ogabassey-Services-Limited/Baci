import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import type { createClient } from '@/lib/supabase/server';

type VirtualTerminalSupabaseClient = ReturnType<typeof createClient>;

type TerminalPatch = { name: string } | { active: false };

function terminalPatchValues(patch: TerminalPatch) {
  return 'name' in patch ? { name: patch.name } : { active: patch.active };
}

export async function verifyTerminalOwnership(
  supabase: VirtualTerminalSupabaseClient,
  merchantId: string,
  code: string
): Promise<NextResponse | null> {
  const { data: merchantRecord, error: merchantError } = await supabase
    .from('merchants')
    .select('virtual_terminal_code')
    .eq('id', merchantId)
    .maybeSingle();

  if (merchantError) {
    logger.error({
      message: 'Database error fetching merchant record',
      error: merchantError,
    });
    return NextResponse.json(
      { error: 'Database error verifying terminal ownership' },
      { status: 500 }
    );
  }

  if (!merchantRecord || merchantRecord.virtual_terminal_code !== code) {
    return NextResponse.json(
      { error: 'Terminal not found or not authorized' },
      { status: 404 }
    );
  }

  return null;
}

export async function syncTerminalRecord(
  supabase: VirtualTerminalSupabaseClient,
  merchantId: string,
  code: string,
  patch: TerminalPatch
): Promise<NextResponse | null> {
  const { data: updatedTerminal, error: updateError } = await supabase
    .from('virtual_terminals')
    .update(terminalPatchValues(patch))
    .eq('merchant_id', merchantId)
    .eq('code', code)
    .select('id')
    .maybeSingle();

  if (updateError) {
    logger.error({
      message: 'Failed to sync virtual terminal record',
      error: updateError,
      merchantId,
      code,
    });
    return NextResponse.json(
      { error: 'Failed to sync Virtual Terminal locally' },
      { status: 500 }
    );
  }

  if (updatedTerminal?.id) return null;

  const name = 'name' in patch ? patch.name : 'Legacy Virtual Terminal';
  const active = 'active' in patch ? patch.active : true;
  const { data: insertedTerminal, error: insertError } = await supabase
    .from('virtual_terminals')
    .insert({
      active,
      code,
      merchant_id: merchantId,
      name,
      payment_link: `https://paystack.com/vt/${code}`,
    })
    .select('id')
    .maybeSingle();

  if (insertError || !insertedTerminal?.id) {
    logger.error({
      message: 'Failed to backfill virtual terminal record',
      error: insertError ?? 'terminal_not_inserted',
      merchantId,
      code,
    });
    return NextResponse.json(
      { error: 'Failed to sync Virtual Terminal locally' },
      { status: 500 }
    );
  }

  return null;
}

export async function clearLegacyTerminalCode(
  supabase: VirtualTerminalSupabaseClient,
  merchantId: string,
  code: string
): Promise<'legacy_clear_failed' | 'legacy_code_not_cleared' | null> {
  const { data: clearedMerchant, error } = await supabase
    .from('merchants')
    .update({ virtual_terminal_code: null })
    .eq('id', merchantId)
    .eq('virtual_terminal_code', code)
    .select('id')
    .maybeSingle();

  if (error) {
    logger.error({
      message: 'Failed to clear legacy virtual terminal code',
      error,
      merchantId,
      code,
    });
    return 'legacy_clear_failed';
  }

  if (!clearedMerchant?.id) {
    logger.error({
      message: 'Legacy virtual terminal code was not cleared',
      error: 'merchant_code_not_updated',
      merchantId,
      code,
    });
    return 'legacy_code_not_cleared';
  }

  return null;
}
