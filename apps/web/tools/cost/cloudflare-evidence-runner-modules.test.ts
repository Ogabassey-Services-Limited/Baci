import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, symlink, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import {
  readEvidenceRunnerModuleDescriptor,
  verifyReviewedEvidenceFile,
  verifyReviewedEvidenceRunnerModule,
} from './cloudflare-evidence-runner-modules';

const workspaceRoot = resolve(import.meta.dirname, '../../../..');
const reviewedModule = resolve(
  workspaceRoot,
  'packages/shared/src/constants/countries.ts'
);
const execFileAsync = promisify(execFile);

describe('cloudflare evidence runner module integrity', () => {
  it('requires an absolute path and SHA-256 descriptor for each runner kind', () => {
    expect(() =>
      readEvidenceRunnerModuleDescriptor(
        { EVIDENCE_MUTATION_RUNNER_MODULE: '/tmp/runner' },
        'mutation'
      )
    ).toThrow('descriptor is required');
    expect(() =>
      readEvidenceRunnerModuleDescriptor(
        {
          EVIDENCE_MEASUREMENT_RUNNER_MODULE: 'relative.ts',
          EVIDENCE_MEASUREMENT_RUNNER_MODULE_SHA256: 'a'.repeat(64),
        },
        'measurement'
      )
    ).toThrow('descriptor is invalid');
  });

  it('rejects an untrusted tooling revision before invoking git', async () => {
    const bytes = await readFile(reviewedModule);
    await expect(
      verifyReviewedEvidenceRunnerModule(workspaceRoot, '--format=%s', {
        path: reviewedModule,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      })
    ).rejects.toThrow('merge SHA is invalid');
  });

  it('binds current bytes to a tracked file in the reviewed tooling commit', async () => {
    const bytes = await readFile(reviewedModule);
    const digest = createHash('sha256').update(bytes).digest('hex');
    const { stdout: head } = await execFileAsync('git', [
      '-C',
      workspaceRoot,
      'rev-parse',
      '--verify',
      'HEAD',
    ]);
    await expect(
      verifyReviewedEvidenceRunnerModule(workspaceRoot, head.trim(), {
        path: reviewedModule,
        sha256: digest,
      })
    ).resolves.toMatchObject({ path: reviewedModule, sha256: digest });
  });

  it('pins a credentialed command entrypoint to the reviewed tooling commit', async () => {
    const { stdout: head } = await execFileAsync('git', [
      '-C',
      workspaceRoot,
      'rev-parse',
      '--verify',
      'HEAD',
    ]);
    await expect(
      verifyReviewedEvidenceFile(workspaceRoot, head.trim(), reviewedModule)
    ).resolves.toMatchObject({ path: reviewedModule });
  });

  it('rejects a replaced runner even when the path remains inside the workspace', async () => {
    const fixture = resolve(
      workspaceRoot,
      'apps/web/tools/cost/.runner-integrity-fixture.ts'
    );
    await writeFile(fixture, 'export const runner = 1;\n', 'utf8');
    try {
      await expect(
        verifyReviewedEvidenceRunnerModule(workspaceRoot, '1'.repeat(40), {
          path: fixture,
          sha256: createHash('sha256')
            .update('export const runner = 1;\n')
            .digest('hex'),
        })
      ).rejects.toThrow('not present in the reviewed commit');
    } finally {
      await import('node:fs/promises').then(({ rm }) =>
        rm(fixture, { force: true })
      );
    }
  });

  it('rejects a symlink alias before resolving it to a tracked runner', async () => {
    const alias = resolve(
      workspaceRoot,
      'apps/web/tools/cost/.runner-integrity-alias.ts'
    );
    const bytes = await readFile(reviewedModule);
    const digest = createHash('sha256').update(bytes).digest('hex');
    const { stdout: head } = await execFileAsync('git', [
      '-C',
      workspaceRoot,
      'rev-parse',
      '--verify',
      'HEAD',
    ]);
    await symlink(reviewedModule, alias);
    try {
      await expect(
        verifyReviewedEvidenceRunnerModule(workspaceRoot, head.trim(), {
          path: alias,
          sha256: digest,
        })
      ).rejects.toThrow('symlink');
    } finally {
      await unlink(alias).catch(() => undefined);
    }
    await expect(lstat(alias)).rejects.toThrow();
  });
});
