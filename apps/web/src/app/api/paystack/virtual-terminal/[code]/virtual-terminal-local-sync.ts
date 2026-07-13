import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import type { createClient } from '@/lib/supabase/server';

type VirtualTerminalSupabaseClient = ReturnType<typeof createClient>;

type TerminalPatch =
  | {
      accountName?: string | null;
      accountNumber?: string | null;
      bank?: string | null;
      name: string;
    }
  | { active: false };

export async function verifyTerminalOwnership(
  supabase: VirtualTerminalSupabaseClient,
  merchantId: string,
  code: string
): Promise<NextResponse | null> {
  const { data: terminalRecord, error: terminalError } = await supabase
    .from('virtual_terminals')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('code', code)
    .maybeSingle();

  if (terminalError) {
    logger.error({
      message: 'Database error fetching virtual terminal record',
      error: terminalError,
      merchantId,
      code,
    });
    return NextResponse.json(
      { error: 'Database error verifying terminal ownership' },
      { status: 500 }
    );
  }

  if (terminalRecord?.id) return null;

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
  const isNamePatch = 'name' in patch;
  const { data: syncedTerminalId, error: syncError } = await supabase.rpc(
    'sync_virtual_terminal_local',
    {
      p_account_name: isNamePatch ? (patch.accountName ?? null) : null,
      p_account_number: isNamePatch ? (patch.accountNumber ?? null) : null,
      p_active: isNamePatch ? null : patch.active,
      p_bank: isNamePatch ? (patch.bank ?? null) : null,
      p_code: code,
      p_merchant_id: merchantId,
      p_name: isNamePatch ? patch.name : null,
    }
  );

  if (syncError || !syncedTerminalId) {
    logger.error({
      message: 'Failed to sync virtual terminal record',
      error: syncError ?? 'terminal_not_synced',
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
): Promise<'legacy_clear_failed' | null> {
  const { error } = await supabase
    .from('merchants')
    .update({ virtual_terminal_code: null })
    .eq('id', merchantId)
    .eq('virtual_terminal_code', code);

  if (error) {
    logger.error({
      message: 'Failed to clear legacy virtual terminal code',
      error,
      merchantId,
      code,
    });
    return 'legacy_clear_failed';
  }

  return null;
}
