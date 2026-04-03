import { type NextRequest, NextResponse } from 'next/server';
import { authenticateApiRequest, hasPermission } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { notifyAdminUserDevices } from '@/lib/expo-push';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { adminPushTestSchema } from '@/schemas/push-test';

export async function POST(request: NextRequest) {
  const { valid: csrfValid, response: csrfResponse } =
    await checkCsrfProtection(request);
  if (!csrfValid) {
    return (
      csrfResponse ??
      NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
    );
  }

  const auth = await authenticateApiRequest(request);
  if (!auth.user || !auth.supabase) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const merchantContext = await getMerchantForApiRequest(
    auth.supabase,
    auth.user.id
  );
  if (!merchantContext) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  const access = toUserAccess(merchantContext);
  if (!hasPermission(access, 'settings', 'view')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminPushTestSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request data', details: parsed.error.format() },
      { status: 400 }
    );
  }

  const result = await notifyAdminUserDevices(
    auth.user.id,
    parsed.data.title,
    parsed.data.body,
    {
      type: 'admin_broadcast',
      source: 'admin_push_test',
      merchant_id: merchantContext.merchantId,
      tested_at: new Date().toISOString(),
    },
    'admin'
  );

  const status =
    result.sent > 0
      ? 'sent'
      : result.errors.length > 0
        ? 'failed'
        : 'skipped_no_tokens';

  return NextResponse.json({
    status,
    sent: result.sent,
    failed: result.failed,
    errors: result.errors,
  });
}
