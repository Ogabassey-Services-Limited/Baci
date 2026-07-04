import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebVitalsHealthResult } from '@/lib/posthog/web-vitals-health';
import { GET, maxDuration } from './route';

vi.mock('@/env', () => ({
  getCronSecret: () => process.env.CRON_SECRET,
}));

const mocks = vi.hoisted(() => ({
  runWebVitalsHealthCheck: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
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
    expect(body.checked_at).toEqual(expect.any(String));
    expect(mocks.loggerError).not.toHaveBeenCalled();
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

  it('returns 200 fail-open when the health check reports a PostHog error', async () => {
    mocks.runWebVitalsHealthCheck.mockResolvedValue({
      status: 'error',
      reason: 'posthog_http_403',
      captureRatio: null,
      warnings: [],
    } satisfies WebVitalsHealthResult);

    const response = await GET(cronRequest(`Bearer ${SECRET}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('error');
    expect(body.reason).toBe('posthog_http_403');
    expect(mocks.loggerError).not.toHaveBeenCalled();
  });
});
