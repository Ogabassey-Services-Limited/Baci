import type { PostHogEnv } from '@/lib/posthog/config';
import {
  getPostHogProjectId,
  getPostHogReleaseContext,
  getPostHogServerApiKey,
  getPostHogUiHost,
} from '@/lib/posthog/config';
import { MOBILE_ONBOARDING_CONTRACT_HEALTH_QUERY } from '@/lib/posthog/mobile-onboarding-contract-health-query';
import { captureServerEvent } from '@/lib/posthog/server';
import { postHogMobileOnboardingHealthResponseSchema } from '@/schemas/mobile-onboarding-contract-health';

const COMPLETE_DAY_COUNT = 8;
const POSTHOG_QUERY_TIMEOUT_MS = 10_000;

export interface MobileOnboardingContractHealthResult {
  status: 'ok' | 'unavailable';
  reason?: string;
  checkedDays: number;
  contiguousHealthyDays: number;
  legacyInvocations: number;
  v2Invocations: number;
  legacyDetected: boolean;
  telemetryGap: boolean;
  missingCanaryDays: string[];
}

function emptyResult(reason: string): MobileOnboardingContractHealthResult {
  return {
    status: 'unavailable',
    reason,
    checkedDays: COMPLETE_DAY_COUNT,
    contiguousHealthyDays: 0,
    legacyInvocations: 0,
    v2Invocations: 0,
    legacyDetected: false,
    telemetryGap: true,
    missingCanaryDays: [],
  };
}

function completeUtcDays(now: Date): string[] {
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  return Array.from({ length: COMPLETE_DAY_COUNT }, (_, index) =>
    new Date(today - (COMPLETE_DAY_COUNT - index) * 86_400_000)
      .toISOString()
      .slice(0, 10)
  );
}

async function queryContractHealth(
  env: PostHogEnv,
  now: Date
): Promise<MobileOnboardingContractHealthResult> {
  const apiKey = getPostHogServerApiKey(env);
  const projectId = getPostHogProjectId(env);
  if (!apiKey || !projectId) {
    return emptyResult('posthog_not_configured');
  }

  let response: Response;
  try {
    response = await fetch(
      `${getPostHogUiHost(env)}/api/projects/${projectId}/query/`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: {
            kind: 'HogQLQuery',
            query: MOBILE_ONBOARDING_CONTRACT_HEALTH_QUERY,
          },
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(POSTHOG_QUERY_TIMEOUT_MS),
      }
    );
  } catch {
    return emptyResult('posthog_request_failed');
  }
  if (!response.ok) {
    return emptyResult(`posthog_http_${response.status}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return emptyResult('posthog_response_unparsable');
  }
  const parsed = postHogMobileOnboardingHealthResponseSchema.safeParse(payload);
  if (!parsed.success) {
    return emptyResult('posthog_response_invalid');
  }

  const days = completeUtcDays(now);
  const canaryDays = new Set<string>();
  const legacyByDay = new Map<string, number>();
  let legacyInvocations = 0;
  let v2Invocations = 0;
  for (const [day, event, contract, total] of parsed.data.results) {
    if (event === 'mobile_onboarding_contract_telemetry_canary') {
      if (total > 0) canaryDays.add(day);
    } else if (contract === 'v1_legacy') {
      legacyInvocations += total;
      legacyByDay.set(day, (legacyByDay.get(day) ?? 0) + total);
    } else {
      v2Invocations += total;
    }
  }

  const missingCanaryDays = days.filter((day) => !canaryDays.has(day));
  let contiguousHealthyDays = 0;
  for (const day of [...days].reverse()) {
    if (!canaryDays.has(day) || (legacyByDay.get(day) ?? 0) > 0) break;
    contiguousHealthyDays += 1;
  }

  return {
    status: missingCanaryDays.length === 0 ? 'ok' : 'unavailable',
    ...(missingCanaryDays.length > 0 ? { reason: 'daily_canary_missing' } : {}),
    checkedDays: COMPLETE_DAY_COUNT,
    contiguousHealthyDays,
    legacyInvocations,
    v2Invocations,
    legacyDetected: legacyInvocations > 0,
    telemetryGap: missingCanaryDays.length > 0,
    missingCanaryDays,
  };
}

export async function runMobileOnboardingContractHealthCheck(
  env: PostHogEnv = process.env,
  now = new Date()
): Promise<MobileOnboardingContractHealthResult> {
  const result = await queryContractHealth(env, now);
  const canaryCaptured = await captureServerEvent(
    'mobile_onboarding_contract_telemetry_canary',
    getPostHogReleaseContext(env)
  );
  if (canaryCaptured) return result;

  return {
    ...result,
    status: 'unavailable',
    reason: result.reason ?? 'canary_capture_failed',
    telemetryGap: true,
  };
}
