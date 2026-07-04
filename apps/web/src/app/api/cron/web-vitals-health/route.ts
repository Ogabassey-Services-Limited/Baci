import { type NextRequest, NextResponse } from 'next/server';
import { getCronSecret } from '@/env';
import { hasValidCronSecret } from '@/lib/cron-secret-auth';
import { logger } from '@/lib/logger';
import {
  getPostHogProjectId,
  getPostHogServerApiKey,
} from '@/lib/posthog/config';
import {
  runWebVitalsHealthCheck,
  type WebVitalsHealthResult,
} from '@/lib/posthog/web-vitals-health';

// Manual fallback only — scheduled by the vercel.json cron entry and/or the VPS
// worker schedule; keep CRON_SECRET gating intact (Vercel cron sends it as the
// Authorization bearer).
export const maxDuration = 60;

// Stable log tag so alerting can grep for the web-vitals capture regression.
const DEGRADED_LOG_TAG = 'web_vitals_health_degraded';
// Distinct stable tag for a cron that can no longer SEE the data (PostHog query
// errored, or skipped despite being configured). Without this, error/skipped
// results return 200 silently and the daily check rots invisibly.
const UNAVAILABLE_LOG_TAG = 'web_vitals_health_unavailable';

function isPostHogQueryConfigured(): boolean {
  return Boolean(getPostHogServerApiKey() && getPostHogProjectId());
}

/**
 * A health result the cron cannot act on. `error` always qualifies. `skipped`
 * only qualifies when PostHog IS configured — a deliberately unconfigured env
 * (no API key / project id) is an expected opt-out that stays quiet at info
 * level rather than paging on every run.
 */
function isUnavailable(result: WebVitalsHealthResult): boolean {
  if (result.status === 'error') {
    return true;
  }

  return result.status === 'skipped' && isPostHogQueryConfigured();
}

export async function GET(request: NextRequest) {
  // Auth: fail-closed when CRON_SECRET is not configured.
  const cronSecret = getCronSecret();
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'Server misconfigured', code: 'server_misconfigured' },
      { status: 500 }
    );
  }

  if (!hasValidCronSecret(request.headers, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Fail-open: runWebVitalsHealthCheck never throws for PostHog-side errors, so
  // the cron always returns 200 with a status the schedule can inspect.
  const result = await runWebVitalsHealthCheck();

  if (result.status === 'degraded') {
    logger.error({
      message: DEGRADED_LOG_TAG,
      captureRatio: result.captureRatio,
      counts: result.counts,
      warnings: result.warnings,
    });
  } else if (isUnavailable(result)) {
    logger.error({
      message: UNAVAILABLE_LOG_TAG,
      status: result.status,
      reason: result.reason,
    });
  } else {
    logger.info({
      message: 'web_vitals_health_checked',
      status: result.status,
      reason: result.reason,
      captureRatio: result.captureRatio,
    });
  }

  return NextResponse.json({ checked_at: new Date().toISOString(), ...result });
}
