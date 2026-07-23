import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  createAdminClient,
  type createClient as createAdminClientFactory,
} from '@/lib/supabase/admin';
import type { createClient } from '@/lib/supabase/server';

type VirtualTerminalSupabaseClient = ReturnType<typeof createClient>;
type VirtualTerminalAdminClient = ReturnType<typeof createAdminClientFactory>;

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

  return NextResponse.json(
    { error: 'Terminal not found or not authorized' },
    { status: 404 }
  );
}

export async function syncTerminalRecord(
  merchantId: string,
  code: string,
  patch: TerminalPatch,
  adminSupabase: VirtualTerminalAdminClient = createAdminClient()
): Promise<NextResponse | null> {
  const isNamePatch = 'name' in patch;
  const { data: syncedTerminalId, error: syncError } = await adminSupabase.rpc(
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
  // Both reading and filtering on the secret `virtual_terminal_code` column are
  // revoked from the authenticated Postgres role (42501 even for an UPDATE).
  // The bounded SECURITY DEFINER RPC clears it atomically (only when it still
  // equals p_code) and re-checks merchant access inside the definer, so this
  // runs on the caller's authenticated client — never a service-role client.
  const { error } = await supabase.rpc('clear_merchant_virtual_terminal_code', {
    p_code: code,
    p_merchant_id: merchantId,
  });

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
