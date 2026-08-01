import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { readReviewedEvidenceDependencyManifest } from './cloudflare-evidence-dependency-integrity';
import { verifyCredentialedEvidenceCommandImportClosure } from './cloudflare-evidence-import-closure';
import {
  readEvidenceDependencyManifestSha256,
  writeEvidenceDependencyIntegrityManifest,
} from './cloudflare-evidence-process-isolation.test-fixtures';

const execFileAsync = promisify(execFile);

describe('credentialed evidence command import closure', () => {
  it('resolves and verifies bare package imports before the command can run', async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'baci-closure-')));
    const packageRoot = join(root, 'node_modules', 'fixture-package');
    const command = resolve(root, 'command.ts');
    await mkdir(packageRoot, { recursive: true });
    await writeFile(join(root, '.gitignore'), 'node_modules\n');
    await writeFile(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
    await writeFile(
      join(packageRoot, 'package.json'),
      '{"name":"fixture-package","main":"index.js"}\n'
    );
    await writeFile(
      join(packageRoot, 'index.js'),
      "const helper = require('./helper.js');\nexports.value = helper.value;\n"
    );
    await writeFile(join(packageRoot, 'helper.js'), 'exports.value = 1;\n');
    await writeFile(
      command,
      "import { value } from 'fixture-package';\nexport { value };\n"
    );
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
      await mkdtemp(join(tmpdir(), 'baci-closure-manifest-')),
      'manifest.json'
    );
    await writeEvidenceDependencyIntegrityManifest(
      manifestPath,
      root,
      stdout.trim(),
      ['fixture-package']
    );
    const manifestSha256 =
      await readEvidenceDependencyManifestSha256(manifestPath);
    try {
      const loaded = await readReviewedEvidenceDependencyManifest(
        root,
        stdout.trim(),
        manifestPath,
        manifestSha256
      );
      await expect(
        verifyCredentialedEvidenceCommandImportClosure(
          root,
          stdout.trim(),
          command,
          loaded.manifest
        )
      ).resolves.toBeUndefined();
      await writeFile(join(packageRoot, 'helper.js'), 'exports.value = 2;\n');
      await expect(
        verifyCredentialedEvidenceCommandImportClosure(
          root,
          stdout.trim(),
          command,
          loaded.manifest
        )
      ).rejects.toThrow('bytes differ');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
