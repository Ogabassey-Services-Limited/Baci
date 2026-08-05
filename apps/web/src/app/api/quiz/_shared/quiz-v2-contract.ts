import {
  QUIZ_CONTRACT_HEADER,
  QUIZ_CONTRACT_VERSION,
} from '@baci/shared/constants';
import { type NextRequest, NextResponse } from 'next/server';
import type { ServerSupabaseClient } from './route-helpers-guards';

const UPDATE_REQUIRED = {
  code: 'QUIZ_APP_UPDATE_REQUIRED',
  error: 'Update the app to continue with this quiz.',
} as const;

const RUNTIME_NOT_READY = {
  code: 'QUIZ_RUNTIME_NOT_READY',
  error: 'Quiz is temporarily unavailable. Please try again soon.',
} as const;

export function requiresQuizV2(request: NextRequest): boolean {
  return (
    request.headers.get(QUIZ_CONTRACT_HEADER) === String(QUIZ_CONTRACT_VERSION)
  );
}

export function hasQuizContractHeader(request: NextRequest): boolean {
  return request.headers.has(QUIZ_CONTRACT_HEADER);
}

export function requireQuizV2Contract(
  request: NextRequest
): NextResponse | null {
  if (requiresQuizV2(request)) return null;
  return NextResponse.json(UPDATE_REQUIRED, { status: 426 });
}

export function rejectUnsupportedQuizContract(
  request: NextRequest
): NextResponse | null {
  const value = request.headers.get(QUIZ_CONTRACT_HEADER);
  if (value === null || value === String(QUIZ_CONTRACT_VERSION)) return null;
  return NextResponse.json(UPDATE_REQUIRED, { status: 426 });
}

export async function requireQuizV2Runtime(
  supabase: ServerSupabaseClient
): Promise<NextResponse | null> {
  const { data, error } = await supabase.rpc('quiz_runtime_contract_version');
  if (error || data !== QUIZ_CONTRACT_VERSION) {
    return NextResponse.json(RUNTIME_NOT_READY, { status: 503 });
  }
  return null;
}

export function readQuizDeviceFingerprint(request: NextRequest): string | null {
  const value = request.headers.get('X-Baci-Quiz-Device-Fingerprint')?.trim();
  return value && /^[0-9a-f]{64}$/.test(value) ? value : null;
}
