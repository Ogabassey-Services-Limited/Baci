import { type NextRequest, NextResponse } from 'next/server';
import { getAppStoreConnectWebhookSecret } from '@/env';
import { verifyAppleWebhookSignature } from '@/lib/apple-webhook-signature';
import { reconcileIosLiveBuild } from '@/lib/ios-live-build-reconcile';
import { logger } from '@/lib/logger';
import { readMobileUpdatesEnabled } from '@/lib/mobile-update-gate';

// App Store Connect webhook (Users and Access > Integrations > Webhooks).
// Apple POSTs here the moment an app version's state changes — most importantly
// to "Ready for Distribution" (live on the App Store). This is the primary,
// event-driven trigger for the in-app update gate; the ios-live-build-sync cron
// is only a once-daily self-heal backstop.
//
// We don't trust the payload's build number: any valid signed event triggers a
// reconcile that reads the authoritative live build from the ASC API. That keeps
// the write correct regardless of Apple's payload schema and is idempotent, so
// reconciling on a non-live event simply no-ops.

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  // Fail-closed when the signing secret is not configured.
  const secret = getAppStoreConnectWebhookSecret();
  if (!secret) {
    return NextResponse.json(
      { error: 'Server misconfigured' },
      { status: 500 }
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get('X-Apple-Signature');
  if (!verifyAppleWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (!readMobileUpdatesEnabled()) {
    return NextResponse.json({ skipped: 'updates_disabled' });
  }

  try {
    const result = await reconcileIosLiveBuild('app_store_connect_webhook');
    if (!result.synced) {
      return NextResponse.json({ skipped: result.skipped });
    }

    logger.info({
      message: 'Synced iOS live build from App Store Connect webhook',
      build: result.build,
      versionString: result.versionString,
    });

    return NextResponse.json({
      synced: true,
      platform: 'ios',
      build: result.build,
      versionString: result.versionString,
    });
  } catch (error) {
    logger.error({
      message: 'appstore-webhook reconcile failed',
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'App Store Connect sync failed' },
      { status: 502 }
    );
  }
}
