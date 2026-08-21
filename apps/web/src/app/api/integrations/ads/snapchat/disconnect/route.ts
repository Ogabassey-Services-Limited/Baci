import { type NextRequest, NextResponse } from 'next/server';
import { SNAPCHAT_ADS_PROVIDER } from '@/lib/ads/snapchat/constants';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';

async function disconnect(request: NextRequest) {
  const auth = await authenticateApiRequest(request);
  if (auth.error || !auth.user || !auth.supabase)
    return NextResponse.json(
      { error: auth.error || 'Unauthorized' },
      { status: 401 }
    );
  const csrf = await checkCsrfProtection(request);
  if (!csrf.valid)
    return (
      csrf.response ??
      NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 })
    );
  const access = await getUserAccess(auth.supabase);
  if (!access)
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  if (!hasPermission(access, 'integrations', 'manage'))
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
  const result = await auth.supabase.rpc('delete_merchant_ads_connection', {
    p_merchant_id: access.merchantId,
    p_provider: SNAPCHAT_ADS_PROVIDER,
  });
  return result.error || result.data !== true
    ? NextResponse.json(
        { error: 'Failed to disconnect Snapchat Ads' },
        { status: 500 }
      )
    : NextResponse.json({ connected: false });
}
export function DELETE(request: NextRequest) {
  return disconnect(request);
}
export function POST(request: NextRequest) {
  return disconnect(request);
}
