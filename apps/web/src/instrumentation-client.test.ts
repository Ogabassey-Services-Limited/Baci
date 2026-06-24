import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  capturePostHogPageview: vi.fn(),
  initializePostHogBrowser: vi.fn(),
}));

vi.mock('@/lib/posthog/browser', () => ({
  capturePostHogPageview: mocks.capturePostHogPageview,
  initializePostHogBrowser: mocks.initializePostHogBrowser,
}));

function importInstrumentationClient() {
  return import('./instrumentation-client');
}

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe('instrumentation-client', () => {
  it('initializes browser PostHog instrumentation', async () => {
    await importInstrumentationClient();

    expect(mocks.initializePostHogBrowser).toHaveBeenCalledOnce();
    expect(mocks.initializePostHogBrowser).toHaveBeenCalledWith(
      expect.objectContaining({
        NODE_ENV: expect.any(String),
      })
    );
    expect(mocks.capturePostHogPageview).toHaveBeenCalledOnce();
  });

  it('does not initialize if imported without a browser window', async () => {
    vi.stubGlobal('window', undefined);

    await importInstrumentationClient();

    expect(mocks.initializePostHogBrowser).not.toHaveBeenCalled();
    expect(mocks.capturePostHogPageview).not.toHaveBeenCalled();
  });
});
