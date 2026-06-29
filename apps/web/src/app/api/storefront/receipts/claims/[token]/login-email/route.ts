import { type NextRequest, NextResponse } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  loadReceiptClaimLoginEmailHint,
  parseReceiptClaimToken,
  recordReceiptClaimLoginStarted,
  recordReceiptClaimLoginStartedBestEffort,
} from '@/lib/import-notifications/receipt-claim-preview';
import { createClient } from '@/lib/supabase/server';

interface RouteContext {
  params: Promise<{ token: string }>;
}

async function parseToken(context: RouteContext) {
  const params = await context.params;
  return parseReceiptClaimToken(params.token);
}

function isAppLoginEmailHintRequest(request: NextRequest) {
  return request.nextUrl.searchParams.get('source') === 'app';
}

export async function GET(request: NextRequest, context: RouteContext) {
  const token = await parseToken(context);
  if (!token) {
    return NextResponse.json(
      { error: 'Invalid receipt claim link' },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();
    const hint = await loadReceiptClaimLoginEmailHint({ supabase, token });

    if (!hint.ok) {
      return NextResponse.json({ error: hint.error }, { status: hint.status });
    }

    if (isAppLoginEmailHintRequest(request)) {
      await recordReceiptClaimLoginStartedBestEffort({
        source: 'app',
        supabase,
        token,
      });
    }

    return NextResponse.json({ emailHint: hint.emailHint });
  } catch (error) {
    console.error('Failed to load receipt claim login email', error);
    return NextResponse.json(
      { error: 'Failed to load receipt claim login email' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const token = await parseToken(context);
  if (!token) {
    return NextResponse.json(
      { error: 'Invalid receipt claim link' },
      { status: 400 }
    );
  }

  const csrf = await checkCsrfProtection(request);
  if (!csrf.valid) {
    return (
      csrf.response ??
      NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
    );
  }

  try {
    const supabase = await createClient();
    await recordReceiptClaimLoginStarted({ source: 'web', supabase, token });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to record receipt claim login start', error);
    return NextResponse.json(
      {
        error: 'Failed to record receipt claim login start',
        code: 'login_start_tracking_failed',
      },
      { status: 500 }
    );
  }
}
