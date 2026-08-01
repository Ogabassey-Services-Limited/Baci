import { execFile } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { createPrivateEvidenceClosure } from './cloudflare-evidence-private-closure';
import {
  readEvidenceDependencyManifestSha256,
  writeEvidenceDependencyIntegrityManifest,
} from './cloudflare-evidence-process-isolation.test-fixtures';

const execFileAsync = promisify(execFile);

describe('private credentialed evidence closure', () => {
  it('executes immutable reviewed bytes after the workspace changes', async () => {
    const root = await realpath(
      await mkdtemp(join(tmpdir(), 'baci-private-closure-'))
    );
    const packageRoot = join(root, 'node_modules', 'fixture-package');
    const tsxRoot = join(root, 'node_modules', 'tsx');
    const launcher = join(root, 'node_modules', '.bin', 'tsx');
    const command = join(root, 'apps/web/tools/cost/command.ts');
    const lockfile = join(root, 'pnpm-lock.yaml');
    await mkdir(dirname(command), { recursive: true, mode: 0o700 });
    await mkdir(packageRoot, { recursive: true, mode: 0o700 });
    await mkdir(join(tsxRoot, 'dist'), { recursive: true, mode: 0o700 });
    await mkdir(dirname(launcher), { recursive: true, mode: 0o700 });
    await writeFile(command, "import 'fixture-package';\n");
    await writeFile(
      join(packageRoot, 'package.json'),
      '{"name":"fixture-package","main":"index.js"}\n'
    );
    await writeFile(join(packageRoot, 'index.js'), 'exports.value = 1;\n');
    await writeFile(
      join(tsxRoot, 'package.json'),
      '{"name":"tsx","bin":"./dist/cli.mjs"}\n'
    );
    await writeFile(join(tsxRoot, 'dist', 'cli.mjs'), '#!/usr/bin/env node\n');
    await symlink('../tsx/dist/cli.mjs', launcher);
    await writeFile(lockfile, 'lockfileVersion: 9.0\n');
    await execFileAsync('git', ['-C', root, 'init', '--quiet']);
    await execFileAsync('git', ['-C', root, 'add', '--', '.']);
    await execFileAsync('git', [
      '-C',
      root,
      '-c',
      'user.email=baci-test@example.invalid',
      '-c',
      'user.name=Baci Test Fixture',
      '-c',
      'commit.gpgsign=false',
      '-c',
      'core.hooksPath=/dev/null',
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
      await mkdtemp(join(tmpdir(), 'baci-private-manifest-')),
      'manifest.json'
    );
    await writeEvidenceDependencyIntegrityManifest(
      manifestPath,
      root,
      stdout.trim(),
      ['fixture-package', 'tsx']
    );
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      packages: Record<string, { root: string; files: Record<string, string> }>;
      lockfileSha256: string;
      toolingMergeSha: string;
    };
    const closure = await createPrivateEvidenceClosure({
      workspaceRoot: root,
      toolingMergeSha: stdout.trim(),
      commandPaths: [command],
      runnerModules: [],
      dependencyManifest: {
        toolingMergeSha: manifest.toolingMergeSha,
        lockfileSha256: manifest.lockfileSha256,
        packages: manifest.packages,
      },
      dependencyManifestPath: manifestPath,
      dependencyManifestSha256:
        await readEvidenceDependencyManifestSha256(manifestPath),
      commandPath: command,
      launcherTarget: join(tsxRoot, 'dist', 'cli.mjs'),
    });
    try {
      const stagedCommand = await readFile(closure.commandPath, 'utf8');
      const stagedLauncher = await readFile(closure.launcherTarget, 'utf8');
      expect(stagedCommand).toContain('fixture-package');
      const { stdout: reviewedCommand } = await execFileAsync('git', [
        '-C',
        closure.root,
        'show',
        `${stdout.trim()}:apps/web/tools/cost/command.ts`,
      ]);
      expect(reviewedCommand).toBe(stagedCommand);
      expect(await readEvidenceDependencyManifestSha256(manifestPath)).toMatch(
        /^[a-f0-9]{64}$/
      );
      await writeFile(command, 'throw new Error("changed");\n');
      expect(await readFile(closure.commandPath, 'utf8')).toBe(stagedCommand);
      await writeFile(join(tsxRoot, 'dist', 'cli.mjs'), 'malicious();\n');
      expect(await readFile(closure.launcherTarget, 'utf8')).toBe(
        stagedLauncher
      );
      expect(closure.root).not.toBe(root);
      expect(closure.launcherTarget).toContain('/node_modules/tsx/');
    } finally {
      await rm(closure.root, { recursive: true, force: true });
      await rm(root, { recursive: true, force: true });
    }
  });
});
