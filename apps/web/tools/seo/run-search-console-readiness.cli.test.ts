import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { seoConstants } from './constants';

const mockAppendGitHubStepSummary = vi.fn();
const mockBuildReadinessSummary = vi.fn(() => '## Search Console Readiness\n');
const mockNormalizeOrigin = vi.fn(() => seoConstants.DEFAULT_PLATFORM_ORIGIN);
const mockRunConfiguredSearchConsoleReadinessAudit = vi.fn();

vi.mock('./shared', () => ({
  seoShared: {
    appendGitHubStepSummary: (...args: unknown[]) =>
      mockAppendGitHubStepSummary(...args),
    normalizeOrigin: (...args: unknown[]) => mockNormalizeOrigin(...args),
  },
}));

vi.mock('./run-search-console-readiness', () => ({
  searchConsoleReadiness: {
    buildReadinessSummary: (...args: unknown[]) =>
      mockBuildReadinessSummary(...args),
    runConfiguredSearchConsoleReadinessAudit: (...args: unknown[]) =>
      mockRunConfiguredSearchConsoleReadinessAudit(...args),
  },
}));

describe('run-search-console-readiness cli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('SEO_PLATFORM_ORIGIN', '');
    vi.stubEnv('SEO_MERCHANT_ORIGINS', '');
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('writes a summary and exits cleanly when readiness passes', async () => {
    const result = {
      passed: true,
      surfaces: [],
    };
    mockRunConfiguredSearchConsoleReadinessAudit.mockResolvedValue(result);

    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { main } = await import('./run-search-console-readiness.cli');

    await main();

    expect(mockRunConfiguredSearchConsoleReadinessAudit).toHaveBeenCalledWith({
      merchantOriginsEnv: undefined,
      platformOrigin: seoConstants.DEFAULT_PLATFORM_ORIGIN,
    });
    expect(mockBuildReadinessSummary).toHaveBeenCalledWith(result);
    expect(mockAppendGitHubStepSummary).toHaveBeenCalledWith(
      '## Search Console Readiness\n'
    );
    expect(log).toHaveBeenCalled();
  });

  it('throws when readiness checks fail', async () => {
    const result = {
      passed: false,
      surfaces: [],
    };
    mockRunConfiguredSearchConsoleReadinessAudit.mockResolvedValue(result);

    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const { main } = await import('./run-search-console-readiness.cli');

    await expect(main()).rejects.toThrow(
      'Search Console readiness checks failed'
    );
    expect(mockBuildReadinessSummary).toHaveBeenCalledWith(result);
    expect(mockAppendGitHubStepSummary).toHaveBeenCalledWith(
      '## Search Console Readiness\n'
    );
    expect(log).toHaveBeenCalled();
  });
});
