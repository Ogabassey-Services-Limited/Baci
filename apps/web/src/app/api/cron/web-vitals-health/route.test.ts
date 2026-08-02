import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebVitalsHealthResult } from '@/lib/posthog/web-vitals-health';
import { GET, maxDuration } from './route';

vi.mock('@/env', () => ({
  getCronSecret: () => process.env.CRON_SECRET,
}));

const mocks = vi.hoisted(() => ({
  runMobileOnboardingContractHealthCheck: vi.fn(),
  runWebVitalsHealthCheck: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
}));

vi.mock('@/lib/posthog/mobile-onboarding-contract-health', () => ({
  runMobileOnboardingContractHealthCheck:
    mocks.runMobileOnboardingContractHealthCheck,
}));

vi.mock('@/lib/posthog/web-vitals-health', () => ({
  runWebVitalsHealthCheck: mocks.runWebVitalsHealthCheck,
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: mocks.loggerError, info: mocks.loggerInfo },
}));

const SECRET = 'test-cron-secret';

function cronRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authHeader) {
    headers.Authorization = authHeader;
  }
  return new NextRequest('http://localhost:3000/api/cron/web-vitals-health', {
    method: 'GET',
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CRON_SECRET', SECRET);
  mocks.runWebVitalsHealthCheck.mockResolvedValue({
    status: 'ok',
    captureRatio: 0.9,
    counts: {
      webVitalsTotal: 500,
      lcp: 100,
      fcp: 95,
      ttfb: 98,
      cls: 100,
      inp: 90,
      vitalsPageviews: 90,
      nonBlogPageviews: 100,
    },
    warnings: [],
  } satisfies WebVitalsHealthResult);
  mocks.runMobileOnboardingContractHealthCheck.mockResolvedValue({
    status: 'ok',
    checkedDays: 8,
    contiguousHealthyDays: 8,
    legacyInvocations: 0,
    v2Invocations: 5,
    legacyDetected: false,
    telemetryGap: false,
    missingCanaryDays: [],
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /api/cron/web-vitals-health', () => {
  it('exposes a bounded maxDuration', () => {
    expect(maxDuration).toBe(60);
  });

  it('returns 500 when CRON_SECRET is not configured', async () => {
    vi.stubEnv('CRON_SECRET', '');

    const response = await GET(cronRequest(`Bearer ${SECRET}`));

    expect(response.status).toBe(500);
    expect(mocks.runWebVitalsHealthCheck).not.toHaveBeenCalled();
  });

  it('returns 401 when the bearer token does not match', async () => {
    const response = await GET(cronRequest('Bearer wrong'));

    expect(response.status).toBe(401);
    expect(mocks.runWebVitalsHealthCheck).not.toHaveBeenCalled();
  });

  it('returns 200 with the health result and does not alert when healthy', async () => {
    const response = await GET(cronRequest(`Bearer ${SECRET}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.mobile_onboarding).toMatchObject({
      status: 'ok',
      v2Invocations: 5,
    });
    expect(body.checked_at).toEqual(expect.any(String));
    expect(mocks.loggerError).not.toHaveBeenCalled();
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'mobile_onboarding_contract_health_checked',
        checkedDays: 8,
        contiguousHealthyDays: 8,
      })
    );
  });

  it('logs legacy contract traffic separately without hiding web-vitals health', async () => {
    mocks.runMobileOnboardingContractHealthCheck.mockResolvedValue({
      status: 'ok',
      checkedDays: 8,
      contiguousHealthyDays: 0,
      legacyInvocations: 2,
      v2Invocations: 5,
      legacyDetected: true,
      telemetryGap: false,
      missingCanaryDays: [],
    });

    const response = await GET(cronRequest(`Bearer ${SECRET}`));
    const body = await response.json();

    expect(body.status).toBe('ok');
    expect(body.mobile_onboarding.legacyDetected).toBe(true);
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'mobile_onboarding_contract_health_legacy_detected',
        legacyInvocations: 2,
      })
    );
  });

  it('logs a telemetry gap when contract health cannot prove zero legacy traffic', async () => {
    mocks.runMobileOnboardingContractHealthCheck.mockResolvedValue({
      status: 'unavailable',
      reason: 'daily_canary_missing',
      checkedDays: 8,
      contiguousHealthyDays: 0,
      legacyInvocations: 0,
      v2Invocations: 0,
      legacyDetected: false,
      telemetryGap: true,
      missingCanaryDays: ['2026-07-27'],
    });

    const response = await GET(cronRequest(`Bearer ${SECRET}`));
    const body = await response.json();

    expect(body.status).toBe('ok');
    expect(body.mobile_onboarding.status).toBe('unavailable');
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'mobile_onboarding_contract_health_telemetry_gap',
        reason: 'daily_canary_missing',
      })
    );
  });

  it('logs a stable degraded tag when the capture health regresses', async () => {
    mocks.runWebVitalsHealthCheck.mockResolvedValue({
      status: 'degraded',
      captureRatio: 0.2,
      counts: {
        webVitalsTotal: 100,
        lcp: 100,
        fcp: 10,
        ttfb: 10,
        cls: 90,
        inp: 80,
        vitalsPageviews: 20,
        nonBlogPageviews: 100,
      },
      warnings: ['low_capture_ratio', 'ttfb_inversion', 'fcp_inversion'],
    } satisfies WebVitalsHealthResult);

    const response = await GET(cronRequest(`Bearer ${SECRET}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('degraded');
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'web_vitals_health_degraded' })
    );
  });

  it('returns 200 fail-open but logs the unavailable tag on a PostHog error', async () => {
    mocks.runWebVitalsHealthCheck.mockResolvedValue({
      status: 'error',
      reason: 'posthog_http_403',
      captureRatio: null,
      warnings: [],
    } satisfies WebVitalsHealthResult);

    const response = await GET(cronRequest(`Bearer ${SECRET}`));
    const body = await response.json();

    // Fail-open contract unchanged...
    expect(response.status).toBe(200);
    expect(body.status).toBe('error');
    expect(body.reason).toBe('posthog_http_403');
    // ...but the cron no longer rots silently.
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'web_vitals_health_unavailable',
        reason: 'posthog_http_403',
      })
    );
  });

  it('logs the unavailable tag when skipped despite PostHog being configured', async () => {
    vi.stubEnv('POSTHOG_API_KEY', 'phx_api_key');
    vi.stubEnv('POSTHOG_PROJECT_ID', '202711');
    mocks.runWebVitalsHealthCheck.mockResolvedValue({
      status: 'skipped',
      reason: 'posthog_not_configured',
      captureRatio: null,
      warnings: [],
    } satisfies WebVitalsHealthResult);

    const response = await GET(cronRequest(`Bearer ${SECRET}`));

    expect(response.status).toBe(200);
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'web_vitals_health_unavailable' })
    );
  });

  it('stays quiet at info level when skipped because PostHog is unconfigured', async () => {
    vi.stubEnv('POSTHOG_API_KEY', '');
    vi.stubEnv('POSTHOG_PROJECT_ID', '');
    mocks.runWebVitalsHealthCheck.mockResolvedValue({
      status: 'skipped',
      reason: 'posthog_not_configured',
      captureRatio: null,
      warnings: [],
    } satisfies WebVitalsHealthResult);

    const response = await GET(cronRequest(`Bearer ${SECRET}`));

    expect(response.status).toBe(200);
    expect(mocks.loggerError).not.toHaveBeenCalled();
    expect(mocks.loggerInfo).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'skipped' })
    );
  });
});
