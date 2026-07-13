import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  getCronSecret,
  getImeiIdentifierEncryptionKey,
  getPetrockConfig,
} from '@/env';
import { hasValidCronSecret } from '@/lib/cron-secret-auth';
import { createPetrockClient } from '@/lib/imei-providers/petrock/petrock-client';
import { resolveClaimedPetrockLookup } from '@/lib/imei-providers/petrock/petrock-lookup-resolution';
import {
  claimPetrockImeiLookups,
  markPetrockSubmissionUnknown,
} from '@/lib/imei-providers/petrock/petrock-lookup-state';
import { createPetrockProvider } from '@/lib/imei-providers/petrock/petrock-provider';
import { runPetrockRemediationNotifications } from '@/lib/imei-remediation/run-petrock-remediation-notifications';
import { runPetrockRemediationReconciliation } from '@/lib/imei-remediation/run-petrock-remediation-reconciliation';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  if (!hasValidCronSecret(request.headers, getCronSecret())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = getPetrockConfig();
  const encryptionKey = getImeiIdentifierEncryptionKey();
  if (!config || !encryptionKey) {
    return NextResponse.json({
      skipped: 'petrock_not_configured',
      success: true,
    });
  }

  const supabaseAdmin = createAdminClient();
  const claimed = await claimPetrockImeiLookups({
    leaseToken: randomUUID(),
    supabaseAdmin,
  });
  const client = createPetrockClient(config);
  const provider = createPetrockProvider({ client });
  const summary = {
    claimed: claimed.length,
    completed: 0,
    errored: 0,
    failed: 0,
    pending: 0,
    submissionUnknown: 0,
  };

  for (const lookup of claimed) {
    try {
      if (lookup.status === 'provider_submitting') {
        const markedUnknown = await markPetrockSubmissionUnknown({
          leaseToken: lookup.lease_token,
          lookupId: lookup.id,
          providerStatus: 'stale_provider_submitting',
          supabaseAdmin,
        });
        if (!markedUnknown) {
          summary.pending += 1;
          continue;
        }
        summary.submissionUnknown += 1;
        console.error('[Petrock Reconcile] Submission identity was not saved', {
          lookupId: lookup.id,
          providerAttemptStartedAt: lookup.provider_attempt_started_at,
        });
        continue;
      }

      const result = await resolveClaimedPetrockLookup({
        attempt: lookup.reconcile_attempts,
        encryptionKey,
        lookup: {
          id: lookup.id,
          identifier_ciphertext: lookup.identifier_ciphertext,
          lease_token: lookup.lease_token,
          provider_order_id: lookup.provider_order_id,
          status: lookup.status,
          tier: lookup.tier,
        },
        provider,
        supabaseAdmin,
      });
      if (result.kind === 'pending' || result.kind === 'lease_lost') {
        summary.pending += 1;
      } else if (result.kind === 'complete') summary.completed += 1;
      else summary.failed += 1;
    } catch (error) {
      summary.errored += 1;
      console.error('[Petrock Reconcile] Lookup resolution failed', {
        error,
        lookupId: lookup.id,
      });
    }
  }

  const remediation = await runPetrockRemediationReconciliation({
    client,
    encryptionKey,
    origin: new URL(request.url).origin,
    supabaseAdmin,
  });
  const notifications = await runPetrockRemediationNotifications({
    supabaseAdmin,
  });

  return NextResponse.json(
    { ...summary, notifications, remediation },
    {
      status:
        summary.errored > 0 ||
        remediation.errored > 0 ||
        notifications.errored > 0
          ? 500
          : 200,
    }
  );
}
