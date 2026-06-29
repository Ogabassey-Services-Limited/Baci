import { type NextRequest, NextResponse } from 'next/server';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  parseReceiptClaimToken,
  recordReceiptClaimAppDownloadClicked,
} from '@/lib/import-notifications/receipt-claim-preview';
import { createClient } from '@/lib/supabase/server';
import { receiptClaimAppDownloadClickBodySchema } from '@/schemas/receipt-claim-app-download-click';

interface RouteContext {
  params: Promise<{ token: string }>;
}

async function parseToken(context: RouteContext) {
  const params = await context.params;
  return parseReceiptClaimToken(params.token);
}

async function parseBody(request: NextRequest) {
  try {
    return receiptClaimAppDownloadClickBodySchema.safeParse(
      await request.json()
    );
  } catch {
    return receiptClaimAppDownloadClickBodySchema.safeParse({});
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

  const parsedBody = await parseBody(request);
  if (!parsedBody.success) {
    return NextResponse.json(
      {
        error: 'Invalid app download tracking target',
        code: 'invalid_download_target',
      },
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
    await recordReceiptClaimAppDownloadClicked({
      supabase,
      target: parsedBody.data.target,
      token,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to record app download click', error);
    return NextResponse.json(
      {
        error: 'Failed to record app download click',
        code: 'app_download_tracking_failed',
      },
      { status: 500 }
    );
  }
}
