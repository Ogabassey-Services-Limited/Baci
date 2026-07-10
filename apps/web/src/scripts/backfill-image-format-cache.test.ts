import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runBackfillImageFormatCacheCli } from './backfill-image-format-cache';

const mockRunImageFormatBackfill = vi.hoisted(() => vi.fn());
vi.mock('@/lib/image-format-backfill', () => ({
  runImageFormatBackfill: (...args: unknown[]) =>
    mockRunImageFormatBackfill(...args),
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: vi.fn(() => ({ from: vi.fn() })),
}));

const mockGetCloudflareApiToken = vi.hoisted(() => vi.fn(() => 'cf-token'));
const mockGetCloudflareZoneId = vi.hoisted(() => vi.fn(() => 'cf-zone'));
vi.mock('@/env', () => ({
  getCloudflareApiToken: () => mockGetCloudflareApiToken(),
  getCloudflareZoneId: () => mockGetCloudflareZoneId(),
}));

function summary(overrides: Record<string, number | boolean> = {}) {
  return {
    products: 0,
    blogPosts: 0,
    urls: 0,
    checked: 0,
    healthy: 0,
    poisoned: 0,
    purgeRequested: 0,
    rewarmed: 0,
    residualNonAvif: 0,
    errored: 0,
    dryRun: false,
    ...overrides,
  };
}

describe('runBackfillImageFormatCacheCli', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    mockRunImageFormatBackfill.mockResolvedValue(summary());
    // Re-prime the env getters every test: a queued `mockReturnValueOnce`
    // from a guard test must never leak into the next test's wet run.
    mockGetCloudflareApiToken.mockReturnValue('cf-token');
    mockGetCloudflareZoneId.mockReturnValue('cf-zone');
  });

  it('parses dry-run limits and concurrency into backfill options', async () => {
    await runBackfillImageFormatCacheCli([
      '--dry-run',
      '--limit',
      '50',
      '--blog-limit',
      '25',
      '--concurrency',
      '8',
    ]);

    expect(mockRunImageFormatBackfill).toHaveBeenCalledWith(
      expect.objectContaining({
        dryRun: true,
        limit: 50,
        blogLimit: 25,
        concurrency: 8,
      })
    );
  });

  it('defaults to a full wet run when no flags are passed', async () => {
    await runBackfillImageFormatCacheCli([]);

    expect(mockRunImageFormatBackfill).toHaveBeenCalledWith(
      expect.objectContaining({
        dryRun: false,
        limit: undefined,
        blogLimit: undefined,
        concurrency: undefined,
      })
    );
  });

  it('rejects an unknown flag without running the backfill', async () => {
    await expect(
      runBackfillImageFormatCacheCli(['--nuke-everything'])
    ).rejects.toThrow('Unknown argument: --nuke-everything');
    expect(mockRunImageFormatBackfill).not.toHaveBeenCalled();
  });

  it.each([
    ['--limit', ['--limit']],
    ['--limit', ['--limit', '0']],
    ['--limit', ['--limit', 'abc']],
    ['--blog-limit', ['--blog-limit']],
    ['--blog-limit', ['--blog-limit', '0']],
    ['--concurrency', ['--concurrency', '-2']],
  ])('rejects %s without a positive integer value', async (flag, argv) => {
    await expect(runBackfillImageFormatCacheCli(argv)).rejects.toThrow(
      `${flag} requires a positive integer`
    );
    expect(mockRunImageFormatBackfill).not.toHaveBeenCalled();
  });

  it('refuses a wet run when Cloudflare purge env is missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockGetCloudflareApiToken.mockReturnValue('');

    await expect(runBackfillImageFormatCacheCli([])).resolves.toBe(1);
    expect(mockRunImageFormatBackfill).not.toHaveBeenCalled();
  });

  it('allows a dry run without Cloudflare purge env (no purge will fire)', async () => {
    mockGetCloudflareApiToken.mockReturnValue('');
    mockGetCloudflareZoneId.mockReturnValue('');

    await expect(runBackfillImageFormatCacheCli(['--dry-run'])).resolves.toBe(
      0
    );
    expect(mockRunImageFormatBackfill).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true })
    );
  });

  it('exits 1 when variants remain non-AVIF after purge + re-warm', async () => {
    mockRunImageFormatBackfill.mockResolvedValueOnce(
      summary({ poisoned: 5, purgeRequested: 5, rewarmed: 3, residualNonAvif: 2 })
    );
    await expect(runBackfillImageFormatCacheCli([])).resolves.toBe(1);
  });

  it('exits 1 only when errors occurred AND nothing was purged', async () => {
    mockRunImageFormatBackfill.mockResolvedValueOnce(
      summary({ errored: 3, purgeRequested: 0 })
    );
    await expect(runBackfillImageFormatCacheCli([])).resolves.toBe(1);
  });

  it.each([
    ['clean run', summary()],
    ['errors alongside successful purges', summary({ errored: 3, purgeRequested: 10 })],
    ['pure success', summary({ poisoned: 5, purgeRequested: 5, rewarmed: 5 })],
  ])('exits 0 for a %s', async (_name, result) => {
    mockRunImageFormatBackfill.mockResolvedValueOnce(result);
    await expect(runBackfillImageFormatCacheCli([])).resolves.toBe(0);
  });

  it('prints the summary as JSON for operator inspection', async () => {
    const logSpy = vi.spyOn(console, 'log');
    const result = summary({ poisoned: 2, purgeRequested: 2 });
    mockRunImageFormatBackfill.mockResolvedValueOnce(result);

    await runBackfillImageFormatCacheCli([]);

    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(result, null, 2));
  });
});
