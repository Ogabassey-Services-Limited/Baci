import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  computeSha256,
  generateQuizAssetManifest,
  verifyQuizAssets,
  writeQuizAssetManifest,
  type QuizAssetManifest,
} from '@/scripts/verify-quiz-assets';

const tempRoots: string[] = [];

async function createTempRepo() {
  const root = await mkdtemp(path.join(tmpdir(), 'quiz-assets-'));
  tempRoots.push(root);
  await mkdir(path.join(root, 'apps/mobile-storefront/assets/quiz'), {
    recursive: true,
  });
  await mkdir(path.join(root, 'apps/mobile-storefront/app/quiz'), {
    recursive: true,
  });
  return root;
}

async function writeManifest(root: string, manifest: QuizAssetManifest) {
  await writeFile(
    path.join(root, 'apps/mobile-storefront/assets/quiz/manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
}

describe('verifyQuizAssets', () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.splice(0).map((root) => rm(root, { recursive: true }))
    );
  });

  it('passes when committed assets match their manifest checksums', async () => {
    const root = await createTempRepo();
    const assetPath = path.join(
      root,
      'apps/mobile-storefront/assets/quiz/Logo.svg'
    );
    await writeFile(assetPath, '<svg>logo</svg>');
    await writeManifest(root, {
      files: [
        {
          path: 'Logo.svg',
          sha256: await computeSha256(assetPath),
          source: '/tmp/quiz-mobile/assets/svg/Logo.svg',
        },
      ],
    });

    await writeFile(
      path.join(root, 'apps/mobile-storefront/app/quiz/index.tsx'),
      "import Logo from '../../assets/quiz/Logo.svg';\nexport default Logo;\n"
    );

    const result = await verifyQuizAssets({ repoRoot: root });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts the generated assets manifest shape with repoPath and sourcePath', async () => {
    const root = await createTempRepo();
    const assetPath = path.join(
      root,
      'apps/mobile-storefront/assets/quiz/svg/Logo.svg'
    );
    await mkdir(path.dirname(assetPath), { recursive: true });
    await writeFile(assetPath, '<svg>logo</svg>');
    await writeFile(
      path.join(root, 'apps/mobile-storefront/assets/quiz/manifest.json'),
      JSON.stringify({
        generatedAt: '2026-05-16',
        assets: [
          {
            sourcePath: '/tmp/quiz-mobile/assets/svg/Logo.svg',
            repoPath: 'apps/mobile-storefront/assets/quiz/svg/Logo.svg',
            sha256: await computeSha256(assetPath),
          },
        ],
      })
    );

    const result = await verifyQuizAssets({ repoRoot: root });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('resolves the monorepo root when invoked from apps/web', async () => {
    const root = await createTempRepo();
    await mkdir(path.join(root, 'apps/web'), { recursive: true });
    await writeFile(path.join(root, 'pnpm-workspace.yaml'), 'packages: []\n');
    const assetPath = path.join(
      root,
      'apps/mobile-storefront/assets/quiz/Logo.svg'
    );
    await writeFile(assetPath, '<svg>logo</svg>');
    await writeManifest(root, {
      files: [{ path: 'Logo.svg', sha256: await computeSha256(assetPath) }],
    });

    const result = await verifyQuizAssets({
      repoRoot: path.join(root, 'apps/web'),
    });

    expect(result.ok).toBe(true);
  });

  it('fails when a manifest asset checksum drifts', async () => {
    const root = await createTempRepo();
    await writeFile(
      path.join(root, 'apps/mobile-storefront/assets/quiz/Logo.svg'),
      '<svg>changed</svg>'
    );
    await writeManifest(root, {
      files: [
        {
          path: 'Logo.svg',
          sha256: '0'.repeat(64),
        },
      ],
    });

    const result = await verifyQuizAssets({ repoRoot: root });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'Checksum mismatch for apps/mobile-storefront/assets/quiz/Logo.svg'
    );
  });

  it('fails when committed assets are missing from the manifest', async () => {
    const root = await createTempRepo();
    const logoPath = path.join(
      root,
      'apps/mobile-storefront/assets/quiz/Logo.svg'
    );
    const coinsPath = path.join(
      root,
      'apps/mobile-storefront/assets/quiz/Coins.svg'
    );
    await writeFile(logoPath, '<svg>logo</svg>');
    await writeFile(coinsPath, '<svg>coins</svg>');
    await writeManifest(root, {
      files: [{ path: 'Logo.svg', sha256: await computeSha256(logoPath) }],
    });

    const result = await verifyQuizAssets({ repoRoot: root });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'Missing quiz asset manifest entry for apps/mobile-storefront/assets/quiz/Coins.svg'
    );
  });

  it('generates and writes a manifest from committed quiz assets', async () => {
    const root = await createTempRepo();
    const logoPath = path.join(
      root,
      'apps/mobile-storefront/assets/quiz/svg/Logo.svg'
    );
    const coinsPath = path.join(
      root,
      'apps/mobile-storefront/assets/quiz/png/Coins.png'
    );
    await mkdir(path.dirname(logoPath), { recursive: true });
    await mkdir(path.dirname(coinsPath), { recursive: true });
    await writeFile(logoPath, '<svg>logo</svg>');
    await writeFile(coinsPath, 'png-bytes');

    await expect(
      generateQuizAssetManifest({
        generatedAt: '2026-05-16T10:00:00.000Z',
        repoRoot: root,
      })
    ).resolves.toMatchObject({
      generatedAt: '2026-05-16T10:00:00.000Z',
      assets: [
        {
          repoPath: 'apps/mobile-storefront/assets/quiz/png/Coins.png',
          sha256: await computeSha256(coinsPath),
        },
        {
          repoPath: 'apps/mobile-storefront/assets/quiz/svg/Logo.svg',
          sha256: await computeSha256(logoPath),
        },
      ],
    });

    await writeQuizAssetManifest({
      generatedAt: '2026-05-16T10:00:00.000Z',
      repoRoot: root,
    });
    const writtenManifest = JSON.parse(
      await readFile(
        path.join(root, 'apps/mobile-storefront/assets/quiz/manifest.json'),
        'utf8'
      )
    ) as unknown;

    expect(writtenManifest).toMatchObject({
      generatedAt: '2026-05-16T10:00:00.000Z',
      note: 'Build-time asset verification manifest',
    });
    await expect(verifyQuizAssets({ repoRoot: root })).resolves.toEqual({
      ok: true,
      errors: [],
    });
  });

  it('rejects invalid caller-provided manifest paths instead of falling back', async () => {
    const root = await createTempRepo();

    await expect(
      verifyQuizAssets({ repoRoot: root, manifestPath: '../manifest.json' })
    ).rejects.toThrow(
      'Invalid quiz asset manifest path: ../manifest.json'
    );
    await expect(
      writeQuizAssetManifest({
        generatedAt: '2026-05-16T10:00:00.000Z',
        manifestPath: '/tmp/manifest.json',
        repoRoot: root,
      })
    ).rejects.toThrow('Invalid quiz asset manifest path: /tmp/manifest.json');
  });

  it('fails fast when the asset tree is unexpectedly deep', async () => {
    const root = await createTempRepo();
    let nestedDirectory = path.join(
      root,
      'apps/mobile-storefront/assets/quiz'
    );
    for (let index = 0; index < 102; index += 1) {
      nestedDirectory = path.join(nestedDirectory, index.toString(36));
      await mkdir(nestedDirectory);
    }

    await expect(generateQuizAssetManifest({ repoRoot: root })).rejects.toThrow(
      'Quiz asset walk exceeded 100 levels'
    );
  });

  it('fails when mobile source imports from the temporary reference repo', async () => {
    const root = await createTempRepo();
    const assetPath = path.join(
      root,
      'apps/mobile-storefront/assets/quiz/Logo.svg'
    );
    await writeFile(assetPath, '<svg>logo</svg>');
    await writeManifest(root, {
      files: [{ path: 'Logo.svg', sha256: await computeSha256(assetPath) }],
    });
    await writeFile(
      path.join(root, 'apps/mobile-storefront/app/quiz/index.tsx'),
      "import Logo from '/tmp/quiz-mobile/assets/svg/Logo.svg';\nexport default Logo;\n"
    );

    const result = await verifyQuizAssets({ repoRoot: root });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(
          'Forbidden quiz-mobile reference in apps/mobile-storefront/app/quiz/index.tsx: /tmp/quiz-mobile'
        ),
      ])
    );
  });

  it('fails fast when the source tree is unexpectedly deep', async () => {
    const root = await createTempRepo();
    const assetPath = path.join(
      root,
      'apps/mobile-storefront/assets/quiz/Logo.svg'
    );
    await writeFile(assetPath, '<svg>logo</svg>');
    await writeManifest(root, {
      files: [{ path: 'Logo.svg', sha256: await computeSha256(assetPath) }],
    });

    let nestedDirectory = path.join(root, 'apps/mobile-storefront/app/quiz');
    for (let index = 0; index < 102; index += 1) {
      nestedDirectory = path.join(nestedDirectory, index.toString(36));
      await mkdir(nestedDirectory);
    }

    const result = await verifyQuizAssets({ repoRoot: root });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'Unable to verify quiz source references: Quiz asset source walk exceeded 100 levels'
    );
  });
});
