import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  verifyQuizAssets,
  writeQuizAssetManifest,
} from '@/scripts/verify-quiz-assets';
import {
  parseArgs,
  runVerifyQuizAssetsCli,
} from '@/scripts/verify-quiz-assets-cli';

vi.mock('@/scripts/verify-quiz-assets', () => ({
  verifyQuizAssets: vi.fn(),
  writeQuizAssetManifest: vi.fn(),
}));

describe('verify quiz assets CLI', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(verifyQuizAssets).mockReset();
    vi.mocked(writeQuizAssetManifest).mockReset();
  });

  it('parses supported flags', () => {
    expect(
      parseArgs([
        '--write-manifest',
        '--generated-at=2026-05-16T10:00:00.000Z',
        '--repo-root=/tmp/repo',
        '--manifest=custom/manifest.json',
      ])
    ).toEqual({
      generatedAt: '2026-05-16T10:00:00.000Z',
      manifestPath: 'custom/manifest.json',
      repoRoot: '/tmp/repo',
      writeManifest: true,
    });
  });

  it('rejects unknown flags', () => {
    expect(() => parseArgs(['--unexpected'])).toThrow(
      'Unknown argument "--unexpected"'
    );
  });

  it('writes the generated manifest when requested', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(writeQuizAssetManifest).mockResolvedValueOnce(undefined);

    await expect(
      runVerifyQuizAssetsCli([
        '--write-manifest',
        '--generated-at=2026-05-16T10:00:00.000Z',
      ])
    ).resolves.toBe(0);

    expect(writeQuizAssetManifest).toHaveBeenCalledWith({
      generatedAt: '2026-05-16T10:00:00.000Z',
      writeManifest: true,
    });
    expect(logSpy).toHaveBeenCalledWith('Quiz asset manifest regenerated');
  });

  it('returns 0 when verification passes', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(verifyQuizAssets).mockResolvedValueOnce({ errors: [], ok: true });

    await expect(runVerifyQuizAssetsCli([])).resolves.toBe(0);

    expect(verifyQuizAssets).toHaveBeenCalledWith({});
    expect(logSpy).toHaveBeenCalledWith('Quiz asset verification passed');
  });

  it('prints errors and returns 1 when verification fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(verifyQuizAssets).mockResolvedValueOnce({
      errors: ['missing asset', 'checksum drift'],
      ok: false,
    });

    await expect(runVerifyQuizAssetsCli(['--repo-root=/tmp/repo'])).resolves.toBe(
      1
    );

    expect(verifyQuizAssets).toHaveBeenCalledWith({ repoRoot: '/tmp/repo' });
    expect(errorSpy).toHaveBeenCalledWith('missing asset');
    expect(errorSpy).toHaveBeenCalledWith('checksum drift');
  });
});
