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

async function flushPostHogMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe('instrumentation-client', () => {
  it('initializes browser PostHog instrumentation', async () => {
    vi.stubGlobal('location', { pathname: '/', href: 'https://usebaci.com/' });

    await importInstrumentationClient();
    await vi.waitFor(() => {
      expect(mocks.initializePostHogBrowser).toHaveBeenCalledOnce();
    });

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

  it('skips PostHog on public blog pages to keep article pages light', async () => {
    vi.stubGlobal('location', {
      pathname: '/blog/phone-guide',
      href: 'https://ogabassey.com/blog/phone-guide',
    });

    await importInstrumentationClient();
    await flushPostHogMicrotasks();
    expect(mocks.initializePostHogBrowser).not.toHaveBeenCalled();
    expect(mocks.capturePostHogPageview).not.toHaveBeenCalled();
  });
});
