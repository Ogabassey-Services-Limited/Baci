import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MOBILE_ONBOARDING_CONTRACT_HEALTH_QUERY } from '@/lib/posthog/mobile-onboarding-contract-health-query';

const mocks = vi.hoisted(() => ({
  captureServerEvent: vi.fn(),
}));

vi.mock('@/lib/posthog/server', () => ({
  captureServerEvent: mocks.captureServerEvent,
}));

import { runMobileOnboardingContractHealthCheck } from '@/lib/posthog/mobile-onboarding-contract-health';

const ENV = {
  NEXT_PUBLIC_POSTHOG_UI_HOST: 'https://eu.posthog.com',
  POSTHOG_API_KEY: 'phx_api_key',
  POSTHOG_PROJECT_ID: '202711',
  VERCEL_GIT_COMMIT_SHA: 'sha-1',
};
const NOW = new Date('2026-07-28T12:00:00.000Z');
const COMPLETE_DAYS = [
  '2026-07-20',
  '2026-07-21',
  '2026-07-22',
  '2026-07-23',
  '2026-07-24',
  '2026-07-25',
  '2026-07-26',
  '2026-07-27',
];

function responseRows(extra: unknown[][] = []): unknown[][] {
  return [
    ...COMPLETE_DAYS.map((day) => [
      day,
      'mobile_onboarding_contract_telemetry_canary',
      'canary',
      1,
    ]),
    ...extra,
  ];
}

function mockQuery(results: unknown[][], status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ results }), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )
  );
}

describe('runMobileOnboardingContractHealthCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.captureServerEvent.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('queries eight complete UTC days and emits today’s identifier-free canary', async () => {
    mockQuery(
      responseRows([
        [
          '2026-07-27',
          'mobile_onboarding_contract_invoked',
          'v2_authenticated',
          4,
        ],
      ])
    );

    const result = await runMobileOnboardingContractHealthCheck(ENV, NOW);

    expect(result).toMatchObject({
      status: 'ok',
      contiguousHealthyDays: 8,
      legacyInvocations: 0,
      v2Invocations: 4,
      legacyDetected: false,
      telemetryGap: false,
    });
    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      query: {
        kind: 'HogQLQuery',
        query: MOBILE_ONBOARDING_CONTRACT_HEALTH_QUERY,
      },
    });
    expect(mocks.captureServerEvent).toHaveBeenCalledWith(
      'mobile_onboarding_contract_telemetry_canary',
      {
        git_commit_sha: 'sha-1',
        release_version: 'sha-1',
      }
    );
  });

  it('reports missing PostHog query configuration as an observable telemetry gap', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const result = await runMobileOnboardingContractHealthCheck({}, NOW);

    expect(result).toMatchObject({
      status: 'unavailable',
      reason: 'posthog_not_configured',
      telemetryGap: true,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('detects legacy traffic and resets the contiguous compatibility window', async () => {
    mockQuery(
      responseRows([
        ['2026-07-27', 'mobile_onboarding_contract_invoked', 'v1_legacy', '2'],
      ])
    );

    const result = await runMobileOnboardingContractHealthCheck(ENV, NOW);

    expect(result).toMatchObject({
      status: 'ok',
      contiguousHealthyDays: 0,
      legacyInvocations: 2,
      legacyDetected: true,
    });
  });

  it('treats a missing daily canary as unavailable, never as zero legacy traffic', async () => {
    mockQuery(responseRows().slice(1));

    const result = await runMobileOnboardingContractHealthCheck(ENV, NOW);

    expect(result).toMatchObject({
      status: 'unavailable',
      reason: 'daily_canary_missing',
      telemetryGap: true,
      missingCanaryDays: ['2026-07-20'],
    });
  });

  it('treats a failed current canary capture as unavailable', async () => {
    mockQuery(responseRows());
    mocks.captureServerEvent.mockResolvedValue(false);

    const result = await runMobileOnboardingContractHealthCheck(ENV, NOW);

    expect(result).toMatchObject({
      status: 'unavailable',
      reason: 'canary_capture_failed',
      telemetryGap: true,
    });
  });

  it('treats non-2xx query responses as unavailable', async () => {
    mockQuery([], 403);

    await expect(
      runMobileOnboardingContractHealthCheck(ENV, NOW)
    ).resolves.toMatchObject({
      status: 'unavailable',
      reason: 'posthog_http_403',
      telemetryGap: true,
    });
  });

  it('treats unparsable and schema-invalid query responses as unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('not-json', { status: 200 })))
    );
    await expect(
      runMobileOnboardingContractHealthCheck(ENV, NOW)
    ).resolves.toMatchObject({
      status: 'unavailable',
      reason: 'posthog_response_unparsable',
    });

    mockQuery([['invalid-row']]);
    await expect(
      runMobileOnboardingContractHealthCheck(ENV, NOW)
    ).resolves.toMatchObject({
      status: 'unavailable',
      reason: 'posthog_response_invalid',
    });
  });

  it('bounds the live query with the Node 24 abort signal', async () => {
    const timeoutSignal = AbortSignal.abort(new Error('timed out'));
    const timeoutSpy = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(timeoutSignal);
    let capturedSignal: AbortSignal | null | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string | URL | Request, init?: RequestInit) => {
        capturedSignal = init?.signal;
        return Promise.reject(timeoutSignal.reason);
      })
    );

    await expect(
      runMobileOnboardingContractHealthCheck(ENV, NOW)
    ).resolves.toMatchObject({
      status: 'unavailable',
      reason: 'posthog_request_failed',
    });
    expect(capturedSignal).toBe(timeoutSignal);
    expect(timeoutSpy).toHaveBeenCalledWith(10_000);
  });
});
