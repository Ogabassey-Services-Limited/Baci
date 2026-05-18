import { describe, expect, it } from 'vitest';
import {
  MAX_SAFE_PATH_LENGTH,
  normalizeQuizAssetManifest,
} from '@/scripts/verify-quiz-assets-manifest';

describe('normalizeQuizAssetManifest', () => {
  it('normalizes hand-authored manifest files', () => {
    const errors: string[] = [];

    expect(
      normalizeQuizAssetManifest(
        {
          files: [
            {
              path: 'png/Coins.png',
              sha256: 'a'.repeat(64),
              source: '/tmp/quiz-mobile/assets/coins.png',
            },
          ],
        },
        errors
      )
    ).toEqual([{ path: 'png/Coins.png', sha256: 'a'.repeat(64) }]);
    expect(errors).toEqual([]);
  });

  it('normalizes generated assets rooted under the quiz asset directory', () => {
    const errors: string[] = [];

    expect(
      normalizeQuizAssetManifest(
        {
          assets: [
            {
              repoPath: 'apps/mobile-storefront/assets/quiz/svg/Logo.svg',
              sha256: 'b'.repeat(64),
              sourcePath: '/tmp/quiz-mobile/assets/svg/Logo.svg',
            },
          ],
          generatedAt: '2026-05-16T10:00:00.000Z',
        },
        errors
      )
    ).toEqual([{ path: 'svg/Logo.svg', sha256: 'b'.repeat(64) }]);
    expect(errors).toEqual([]);
  });

  it('normalizes generated asset repoPath separators', () => {
    const errors: string[] = [];

    expect(
      normalizeQuizAssetManifest(
        {
          assets: [
            {
              repoPath: 'apps\\mobile-storefront\\assets\\quiz\\svg\\Logo.svg',
              sha256: 'b'.repeat(64),
            },
          ],
        },
        errors
      )
    ).toEqual([{ path: 'svg/Logo.svg', sha256: 'b'.repeat(64) }]);
    expect(errors).toEqual([]);
  });

  it('accepts uppercase SHA-256 values and normalizes them for checksum comparison', () => {
    const errors: string[] = [];

    expect(
      normalizeQuizAssetManifest(
        {
          files: [
            {
              path: 'png/Coins.png',
              sha256: 'A'.repeat(64),
            },
          ],
        },
        errors
      )
    ).toEqual([{ path: 'png/Coins.png', sha256: 'a'.repeat(64) }]);
    expect(errors).toEqual([]);
  });

  it('normalizes hand-authored manifest file path separators', () => {
    const errors: string[] = [];

    expect(
      normalizeQuizAssetManifest(
        {
          files: [{ path: 'png\\Coins.png', sha256: 'a'.repeat(64) }],
        },
        errors
      )
    ).toEqual([{ path: 'png/Coins.png', sha256: 'a'.repeat(64) }]);
    expect(errors).toEqual([]);
  });

  it('accepts empty files and generated assets arrays without errors', () => {
    const fileErrors: string[] = [];
    const assetErrors: string[] = [];

    expect(normalizeQuizAssetManifest({ files: [] }, fileErrors)).toEqual([]);
    expect(normalizeQuizAssetManifest({ assets: [] }, assetErrors)).toEqual(
      []
    );
    expect(fileErrors).toEqual([]);
    expect(assetErrors).toEqual([]);
  });

  it('rejects invalid checksums and unsafe manifest paths', () => {
    const checksumErrors: string[] = [];
    expect(
      normalizeQuizAssetManifest(
        { files: [{ path: 'png/Coins.png', sha256: 'not-a-sha' }] },
        checksumErrors
      )
    ).toEqual([]);
    expect(checksumErrors).toContain(
      'Quiz asset manifest entries must include valid path and sha256'
    );

    for (const path of [
      'png/\0Coins.png',
      '../Coins.png',
      '/tmp/Coins.png',
      'C:\\tmp\\Coins.png',
      'png/'.padEnd(MAX_SAFE_PATH_LENGTH + 1, 'a'),
    ]) {
      const errors: string[] = [];
      expect(
        normalizeQuizAssetManifest(
          { files: [{ path, sha256: 'a'.repeat(64) }] },
          errors
        )
      ).toEqual([]);
      expect(errors).toContain(
        'Quiz asset manifest entries must include valid path and sha256'
      );
    }
  });

  it('prefers files entries over generated assets entries', () => {
    const errors: string[] = [];

    expect(
      normalizeQuizAssetManifest(
        {
          assets: [
            {
              repoPath: 'apps/mobile-storefront/assets/quiz/svg/Ignored.svg',
              sha256: 'b'.repeat(64),
            },
          ],
          files: [{ path: 'png/Coins.png', sha256: 'a'.repeat(64) }],
        },
        errors
      )
    ).toEqual([{ path: 'png/Coins.png', sha256: 'a'.repeat(64) }]);
    expect(errors).toEqual([]);
  });

  it('rejects malformed manifest shapes', () => {
    const objectErrors: string[] = [];
    expect(normalizeQuizAssetManifest(null, objectErrors)).toBeNull();
    expect(objectErrors).toContain('Quiz asset manifest must be a JSON object');

    const filesErrors: string[] = [];
    expect(
      normalizeQuizAssetManifest({ files: {} }, filesErrors)
    ).toBeNull();
    expect(filesErrors).toContain('Quiz asset manifest files must be an array');

    const assetsErrors: string[] = [];
    expect(
      normalizeQuizAssetManifest({ assets: {} }, assetsErrors)
    ).toBeNull();
    expect(assetsErrors).toContain('Quiz asset manifest assets must be an array');

    const missingErrors: string[] = [];
    expect(normalizeQuizAssetManifest({}, missingErrors)).toBeNull();
    expect(missingErrors).toContain(
      'Quiz asset manifest must contain a files or assets array'
    );
  });

  it('keeps valid entries and reports malformed entries', () => {
    const errors: string[] = [];

    expect(
      normalizeQuizAssetManifest(
        {
          files: [
            { path: 'png/Coins.png', sha256: 'c'.repeat(64) },
            { path: '', sha256: 'not-a-sha' },
          ],
        },
        errors
      )
    ).toEqual([{ path: 'png/Coins.png', sha256: 'c'.repeat(64) }]);
    expect(errors).toContain(
      'Quiz asset manifest entries must include valid path and sha256'
    );
  });

  it('reports malformed generated asset entries with repoPath-specific errors', () => {
    const errors: string[] = [];

    expect(
      normalizeQuizAssetManifest(
        {
          assets: [{ repoPath: '', sha256: 'not-a-sha' }],
        },
        errors
      )
    ).toEqual([]);
    expect(errors).toContain(
      'Quiz asset manifest entries must include valid repoPath and sha256'
    );
  });

  it('rejects generated manifest assets outside the committed quiz asset root', () => {
    const errors: string[] = [];

    const result = normalizeQuizAssetManifest(
      {
        assets: [
          {
            repoPath: 'apps/mobile-storefront/assets/not-quiz/Logo.svg',
            sha256: 'd'.repeat(64),
            sourcePath: '/tmp/quiz-mobile/assets/svg/Logo.svg',
          },
        ],
      },
      errors
    );

    expect(result).toEqual([]);
    expect(errors).toContain(
      'Invalid quiz asset repoPath: apps/mobile-storefront/assets/not-quiz/Logo.svg'
    );
  });
});
