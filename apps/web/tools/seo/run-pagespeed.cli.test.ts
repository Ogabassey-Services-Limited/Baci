import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seoConstants } from './constants';

const mockAppendGitHubStepSummary = vi.fn();
const mockNormalizeOrigin = vi.fn(() => seoConstants.DEFAULT_PLATFORM_ORIGIN);
const mockBuildPageSpeedSummary = vi.fn(() => '## PageSpeed Insights\n');
const mockParseStrategies = vi.fn(() => ['mobile']);
const mockRunPageSpeedAudit = vi.fn();

vi.mock('./shared', () => ({
  seoShared: {
    appendGitHubStepSummary: (...args: unknown[]) =>
      mockAppendGitHubStepSummary(...args),
    normalizeOrigin: (...args: unknown[]) => mockNormalizeOrigin(...args),
  },
}));

vi.mock('./run-pagespeed', () => ({
  pageSpeedTools: {
    buildPageSpeedSummary: (...args: unknown[]) =>
      mockBuildPageSpeedSummary(...args),
    parseStrategies: (...args: unknown[]) => mockParseStrategies(...args),
    runPageSpeedAudit: (...args: unknown[]) => mockRunPageSpeedAudit(...args),
  },
}));

describe('run-pagespeed cli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('writes a summary and exits cleanly when audits pass', async () => {
    mockRunPageSpeedAudit.mockResolvedValue([
      {
        label: 'home',
        url: `${seoConstants.DEFAULT_PLATFORM_ORIGIN}/`,
        strategy: 'mobile',
        passed: true,
        failures: [],
        scores: {},
        vitals: {},
      },
    ]);

    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { main } = await import('./run-pagespeed.cli');

    await main();

    expect(mockRunPageSpeedAudit).toHaveBeenCalled();
    expect(mockAppendGitHubStepSummary).toHaveBeenCalledWith(
      '## PageSpeed Insights\n'
    );
    expect(log).toHaveBeenCalled();
  });

  it('throws when at least one audit fails', async () => {
    mockRunPageSpeedAudit.mockResolvedValue([
      {
        label: 'home',
        url: `${seoConstants.DEFAULT_PLATFORM_ORIGIN}/`,
        strategy: 'mobile',
        passed: false,
        failures: [{ metric: 'seo', actual: 0.5, threshold: 0.9 }],
        scores: {},
        vitals: {},
      },
    ]);

    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { main } = await import('./run-pagespeed.cli');

    await expect(main()).rejects.toThrow(
      'PageSpeed monitoring found 1 failing audits'
    );
    expect(log).toHaveBeenCalled();
  });

  it('passes raw extra urls through to the audit layer for validation', async () => {
    vi.stubEnv('PAGESPEED_EXTRA_URLS', 'notaurl,https://ogabassey.com');
    mockRunPageSpeedAudit.mockResolvedValue([]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { main } = await import('./run-pagespeed.cli');

    await main();

    expect(mockRunPageSpeedAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        extraUrls: ['notaurl', 'https://ogabassey.com'],
      })
    );
    expect(log).toHaveBeenCalled();
  });
});
