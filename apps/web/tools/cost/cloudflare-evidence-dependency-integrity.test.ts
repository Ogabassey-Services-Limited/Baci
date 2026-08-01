import { execFile } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import {
  readReviewedEvidenceDependencyManifest,
  verifyEvidenceDependencyFile,
} from './cloudflare-evidence-dependency-integrity';
import { writeEvidenceDependencyIntegrityManifest } from './cloudflare-evidence-process-isolation.test-fixtures';

const execFileAsync = promisify(execFile);

async function createFixture() {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-dependency-'))
  );
  const packageRoot = join(root, 'node_modules', 'fixture-package');
  await mkdir(packageRoot, { recursive: true });
  await writeFile(join(root, '.gitignore'), 'node_modules\n');
  await writeFile(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
  await writeFile(
    join(packageRoot, 'package.json'),
    '{"name":"fixture-package","main":"index.js"}\n'
  );
  await writeFile(join(packageRoot, 'index.js'), 'exports.value = 1;\n');
  await execFileAsync('git', ['-C', root, 'init', '--quiet']);
  await execFileAsync('git', ['-C', root, 'add', '--', '.']);
  await execFileAsync('git', [
    '-C',
    root,
    '-c',
    'user.email=baci-test@example.invalid',
    '-c',
    'user.name=Baci Test Fixture',
    'commit',
    '--quiet',
    '-m',
    'fixture',
  ]);
  const { stdout } = await execFileAsync('git', [
    '-C',
    root,
    'rev-parse',
    '--verify',
    'HEAD',
  ]);
  const manifestPath = join(
    await mkdtemp(join(tmpdir(), 'baci-dependency-manifest-')),
    'manifest.json'
  );
  await writeEvidenceDependencyIntegrityManifest(
    manifestPath,
    root,
    stdout.trim(),
    ['fixture-package']
  );
  return { root, packageRoot, manifestPath, toolingMergeSha: stdout.trim() };
}

describe('cloudflare evidence dependency integrity', () => {
  it('binds the owner manifest to the reviewed tooling SHA and lockfile bytes', async () => {
    const fixture = await createFixture();
    try {
      await expect(
        readReviewedEvidenceDependencyManifest(
          fixture.root,
          fixture.toolingMergeSha,
          fixture.manifestPath
        )
      ).resolves.toMatchObject({ path: fixture.manifestPath });
      await writeFile(join(fixture.root, 'pnpm-lock.yaml'), 'tampered\n');
      await expect(
        readReviewedEvidenceDependencyManifest(
          fixture.root,
          fixture.toolingMergeSha,
          fixture.manifestPath
        )
      ).rejects.toThrow('lockfile');
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it('rejects replacement bytes for a resolved bare package file', async () => {
    const fixture = await createFixture();
    try {
      const loaded = await readReviewedEvidenceDependencyManifest(
        fixture.root,
        fixture.toolingMergeSha,
        fixture.manifestPath
      );
      const packageFile = join(fixture.packageRoot, 'index.js');
      await expect(
        verifyEvidenceDependencyFile(
          fixture.root,
          'fixture-package',
          packageFile,
          loaded.manifest
        )
      ).resolves.toBe(packageFile);
      await writeFile(packageFile, 'exports.value = 2;\n');
      await expect(
        verifyEvidenceDependencyFile(
          fixture.root,
          'fixture-package',
          packageFile,
          loaded.manifest
        )
      ).rejects.toThrow('bytes differ');
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });

  it('rejects a symlinked manifest parent before reading authority', async () => {
    const fixture = await createFixture();
    const aliasDirectory = join(fixture.root, 'manifest-alias');
    try {
      await symlink(dirname(fixture.manifestPath), aliasDirectory, 'dir');
      await expect(
        readReviewedEvidenceDependencyManifest(
          fixture.root,
          fixture.toolingMergeSha,
          join(aliasDirectory, 'manifest.json')
        )
      ).rejects.toThrow('parent');
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  });
});
