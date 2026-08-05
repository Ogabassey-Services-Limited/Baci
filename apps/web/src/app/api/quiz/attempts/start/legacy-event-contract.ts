import { NextResponse } from 'next/server';
import { rpcErrorResponse } from '@/app/api/quiz/_shared/route-auth';
import type { ServerSupabaseClient } from '@/app/api/quiz/_shared/route-helpers-guards';

export async function rejectLegacyV2EventStart(
  supabase: ServerSupabaseClient,
  eventId: string
) {
  const { data, error } = await supabase
    .from('quiz_events')
    .select('contract_version')
    .eq('id', eventId)
    .maybeSingle();
  if (error) return rpcErrorResponse();
  const version =
    data && typeof data === 'object' && 'contract_version' in data
      ? (data as { contract_version?: unknown }).contract_version
      : null;
  if (version !== 2) return null;
  return NextResponse.json(
    {
      code: 'QUIZ_APP_UPDATE_REQUIRED',
      error: 'Update the app to continue with this quiz.',
    },
    { status: 426 }
  );
}
