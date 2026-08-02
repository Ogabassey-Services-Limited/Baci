import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmod,
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
import { describe, expect, it, vi } from 'vitest';
import { spawnIsolatedCloudflareEvidenceProcess } from './cloudflare-evidence-process-isolation';
import {
  createEvidenceDependencyIntegrityAuthority,
  readEvidenceDependencyManifestSha256,
} from './cloudflare-evidence-process-isolation.test-fixtures';
import { openEvidenceRun } from './cloudflare-evidence-run-journal';

const execFileAsync = promisify(execFile);

describe('spawnIsolatedCloudflareEvidenceProcess credential boundaries', () => {
  it('rejects wrong and inherited credential combinations before spawning', async () => {
    const spawn = vi.fn(async () => undefined);
    await expect(
      spawnIsolatedCloudflareEvidenceProcess(
        { spawn },
        'measure',
        'run',
        {},
        { name: 'CLOUDFLARE_WRITE_TOKEN', value: 'write' },
        '/workspace',
        '/private/evidence-state'
      )
    ).rejects.toThrow('read');
    await expect(
      spawnIsolatedCloudflareEvidenceProcess(
        { spawn },
        'mutate',
        'run',
        { CLOUDFLARE_READ_TOKEN: 'read', CLOUDFLARE_WRITE_TOKEN: 'write' },
        { name: 'CLOUDFLARE_WRITE_TOKEN', value: 'write' },
        '/workspace',
        '/private/evidence-state'
      )
    ).rejects.toThrow('inherited');
  });

  it('keeps receipt-only read-token recovery credentialless', async () => {
    const spawn = vi.fn(async () => undefined);
    for (const inherited of [
      { CLOUDFLARE_READ_TOKEN: 'read' },
      { CLOUDFLARE_WRITE_TOKEN: 'write' },
    ])
      await expect(
        spawnIsolatedCloudflareEvidenceProcess(
          { spawn },
          'record-read-revocation',
          'run',
          inherited,
          undefined,
          '/workspace',
          '/private/evidence-state'
        )
      ).rejects.toThrow('must not receive a Cloudflare credential');
    await expect(
      spawnIsolatedCloudflareEvidenceProcess(
        { spawn },
        'record-read-revocation',
        'run',
        {},
        { name: 'CLOUDFLARE_READ_TOKEN', value: 'read' },
        '/workspace',
        '/private/evidence-state'
      )
    ).rejects.toThrow('command credential responsibility is invalid');
    expect(spawn).not.toHaveBeenCalled();
  });

  it('rejects a changed transitive command import before spawning a credential', async () => {
    const root = await realpath(
      await mkdtemp(join(tmpdir(), 'baci-command-integrity-'))
    );
    const toolsDir = join(root, 'apps/web/tools/cost');
    const commandPath = join(toolsDir, 'mutate-cloudflare-evidence-sources.ts');
    const dependencyPath = join(toolsDir, 'command-helper.ts');
    const runnerPath = join(toolsDir, 'runner.ts');
    const packageRoot = join(root, 'node_modules', 'fixture-package');
    const tsxRoot = join(root, 'node_modules', 'tsx');
    const binRoot = join(root, 'node_modules', '.bin');
    const launcher = join(binRoot, 'tsx');
    const tsxCli = join(tsxRoot, 'dist', 'cli.mjs');
    const stateDir = await mkdtemp(join(tmpdir(), 'baci-command-state-'));
    await chmod(stateDir, 0o700);
    await mkdir(toolsDir, { recursive: true });
    await mkdir(packageRoot, { recursive: true });
    await mkdir(join(tsxRoot, 'dist'), { recursive: true });
    await mkdir(binRoot, { recursive: true });
    await writeFile(
      commandPath,
      "import { value } from './command-helper';\nimport { packageValue } from 'fixture-package';\nexport { value, packageValue };\n"
    );
    await writeFile(dependencyPath, 'export const value = 1;\n');
    await writeFile(runnerPath, 'export const runner = 1;\n');
    await writeFile(join(root, '.gitignore'), 'node_modules\n');
    await writeFile(
      join(packageRoot, 'package.json'),
      '{"name":"fixture-package","main":"index.js"}\n'
    );
    await writeFile(
      join(packageRoot, 'index.js'),
      'exports.packageValue = 1;\n'
    );
    await writeFile(
      join(tsxRoot, 'package.json'),
      '{"name":"tsx","bin":"./dist/cli.mjs"}\n'
    );
    await writeFile(tsxCli, '#!/usr/bin/env node\n');
    await symlink('../tsx/dist/cli.mjs', launcher);
    await writeFile(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
    await execFileAsync('git', [
      '-C',
      root,
      '-c',
      'init.defaultBranch=main',
      'init',
      '--quiet',
    ]);
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
    const { stdout: head } = await execFileAsync('git', [
      '-C',
      root,
      'rev-parse',
      '--verify',
      'HEAD',
    ]);
    const runnerModuleSha256 = createHash('sha256')
      .update(await readFile(runnerPath))
      .digest('hex');
    const { manifestPath, protectedMergeIdentityPath } =
      await createEvidenceDependencyIntegrityAuthority(root, head.trim(), [
        'fixture-package',
        'tsx',
      ]);
    const dependencyManifestSha256 =
      await readEvidenceDependencyManifestSha256(manifestPath);
    const runId = 'a'.repeat(32);
    const input = {
      runId,
      approvalId: 'approval',
      policyId: 'policy',
      toolingMergeSha: head.trim(),
      writeTokenId: 'write-token',
      readTokenId: 'read-token',
      readPolicySha256: 'b'.repeat(64),
      accountId: 'account',
      zoneId: 'zone',
      plannedResources: ['resource'],
      preInventorySha256: 'c'.repeat(64),
      expectedProbeCount: 2,
      mutationRunnerModulePath: runnerPath,
      mutationRunnerModuleSha256: runnerModuleSha256,
      measurementRunnerModulePath: runnerPath,
      measurementRunnerModuleSha256: runnerModuleSha256,
      dependencyManifestSha256,
    } as const;
    const originalCommand = await readFile(commandPath, 'utf8');
    const spawn = vi.fn(async (_executable, argv) => {
      if (!argv[1]?.includes('baci-evidence-closure-')) return;
      await writeFile(
        commandPath,
        'throw new Error("workspace replacement");\n'
      );
      expect(await readFile(argv[1], 'utf8')).toBe(originalCommand);
      await writeFile(commandPath, originalCommand);
    });
    try {
      await openEvidenceRun(stateDir, input);
      await spawnIsolatedCloudflareEvidenceProcess(
        { spawn },
        'mutate',
        runId,
        {
          PATH: dirname(process.execPath),
          EVIDENCE_DEPENDENCY_INTEGRITY_MANIFEST: manifestPath,
          EVIDENCE_PROTECTED_MERGE_IDENTITY_ARTIFACT:
            protectedMergeIdentityPath,
        },
        { name: 'CLOUDFLARE_WRITE_TOKEN', value: 'write' },
        root,
        stateDir
      );
      expect(spawn).toHaveBeenCalledTimes(1);
      expect(spawn.mock.calls[0]?.[0]).toBe(process.execPath);
      const [executable, argv, options] = spawn.mock.calls[0] ?? [];
      expect(executable).toBe(process.execPath);
      expect(argv?.[0]).not.toBe(tsxCli);
      expect(argv?.[0]).toContain('baci-evidence-closure-');
      expect(argv?.[1]).not.toBe(commandPath);
      expect(argv?.[1]).toContain('baci-evidence-closure-');
      expect(argv?.slice(2)).toEqual(['--run', runId, '--apply']);
      expect(options?.cwd).toContain('baci-evidence-closure-');
      await writeFile(
        join(packageRoot, 'index.js'),
        'exports.packageValue = 2;\n'
      );
      await expect(
        spawnIsolatedCloudflareEvidenceProcess(
          { spawn },
          'mutate',
          runId,
          {
            PATH: dirname(process.execPath),
            EVIDENCE_DEPENDENCY_INTEGRITY_MANIFEST: manifestPath,
            EVIDENCE_PROTECTED_MERGE_IDENTITY_ARTIFACT:
              protectedMergeIdentityPath,
          },
          { name: 'CLOUDFLARE_WRITE_TOKEN', value: 'write' },
          root,
          stateDir
        )
      ).rejects.toThrow('bytes differ from reviewed integrity metadata');
      expect(spawn).toHaveBeenCalledTimes(1);
      await writeFile(
        join(packageRoot, 'index.js'),
        'exports.packageValue = 1;\n'
      );
      await writeFile(dependencyPath, 'export const value = 2;\n');
      await expect(
        spawnIsolatedCloudflareEvidenceProcess(
          { spawn },
          'mutate',
          runId,
          {
            PATH: dirname(process.execPath),
            EVIDENCE_DEPENDENCY_INTEGRITY_MANIFEST: manifestPath,
            EVIDENCE_PROTECTED_MERGE_IDENTITY_ARTIFACT:
              protectedMergeIdentityPath,
          },
          { name: 'CLOUDFLARE_WRITE_TOKEN', value: 'write' },
          root,
          stateDir
        )
      ).rejects.toThrow('differs from the reviewed commit');
      expect(spawn).toHaveBeenCalledTimes(1);
      await rm(launcher);
      await writeFile(launcher, '#!/usr/bin/env node\nmalicious();\n', {
        mode: 0o755,
      });
      await expect(
        spawnIsolatedCloudflareEvidenceProcess(
          { spawn },
          'mutate',
          runId,
          {
            PATH: dirname(process.execPath),
            EVIDENCE_DEPENDENCY_INTEGRITY_MANIFEST: manifestPath,
            EVIDENCE_PROTECTED_MERGE_IDENTITY_ARTIFACT:
              protectedMergeIdentityPath,
          },
          { name: 'CLOUDFLARE_WRITE_TOKEN', value: 'write' },
          root,
          stateDir
        )
      ).rejects.toThrow('launcher');
      expect(spawn).toHaveBeenCalledTimes(1);
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(stateDir, { recursive: true, force: true });
    }
  });
});
