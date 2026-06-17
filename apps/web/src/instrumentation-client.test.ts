import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildPostHogClientConfig: vi.fn(() => ({
    api_host: '/ingest/static',
  })),
  posthogInit: vi.fn(),
}));

vi.mock('posthog-js', () => ({
  default: {
    init: mocks.posthogInit,
  },
}));

vi.mock('@/lib/posthog/client-config', () => ({
  buildPostHogClientConfig: mocks.buildPostHogClientConfig,
}));

function importInstrumentationClient() {
  return import('./instrumentation-client');
}

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe('instrumentation-client', () => {
  it('initializes PostHog when a public project token is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', 'ph_project_token');

    await importInstrumentationClient();

    expect(mocks.buildPostHogClientConfig).toHaveBeenCalledOnce();
    expect(mocks.posthogInit).toHaveBeenCalledWith('ph_project_token', {
      api_host: '/ingest/static',
    });
  });

  it('warns in development when PostHog is not configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', '');
    vi.stubEnv('NODE_ENV', 'development');
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    await importInstrumentationClient();

    expect(mocks.posthogInit).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      '[PostHog] NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is missing; web analytics and error capture are disabled.'
    );
  });

  it('stays quiet outside development when PostHog is not configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN', '');
    vi.stubEnv('NODE_ENV', 'production');
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);

    await importInstrumentationClient();

    expect(mocks.posthogInit).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
