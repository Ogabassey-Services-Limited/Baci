import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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

async function createReviewedFixture() {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-runner-integrity-'))
  );
  await writeFile(
    resolve(root, 'runner.ts'),
    "import { value } from './helper';\nexport { value };\n",
    'utf8'
  );
  await writeFile(
    resolve(root, 'helper.ts'),
    'export const value = 1;\n',
    'utf8'
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
  const { stdout: head } = await execFileAsync('git', [
    '-C',
    root,
    'rev-parse',
    '--verify',
    'HEAD',
  ]);
  return { root, head: head.trim() };
}

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
    const root = await realpath(
      await mkdtemp(join(tmpdir(), 'baci-runner-integrity-'))
    );
    const fixture = resolve(root, 'runner.ts');
    await writeFile(fixture, 'export const runner = 1;\n', 'utf8');
    try {
      await expect(
        verifyReviewedEvidenceRunnerModule(root, '1'.repeat(40), {
          path: fixture,
          sha256: createHash('sha256')
            .update('export const runner = 1;\n')
            .digest('hex'),
        })
      ).rejects.toThrow('not present in the reviewed commit');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects a symlink alias before resolving it to a tracked runner', async () => {
    const root = await realpath(
      await mkdtemp(join(tmpdir(), 'baci-runner-integrity-'))
    );
    const target = resolve(root, 'runner.ts');
    const alias = resolve(root, 'alias.ts');
    const bytes = Buffer.from('export const runner = 1;\n');
    const digest = createHash('sha256').update(bytes).digest('hex');
    await writeFile(target, bytes);
    await symlink(target, alias);
    try {
      await expect(
        verifyReviewedEvidenceRunnerModule(root, '1'.repeat(40), {
          path: alias,
          sha256: digest,
        })
      ).rejects.toThrow('symlink');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects a changed transitive import before the runner can load', async () => {
    const { root, head } = await createReviewedFixture();
    const entry = resolve(root, 'runner.ts');
    const dependency = resolve(root, 'helper.ts');
    const entryBytes = await readFile(entry);
    const dependencyBytes = await readFile(dependency);
    const digest = createHash('sha256').update(entryBytes).digest('hex');
    const descriptor = { path: entry, sha256: digest };
    try {
      await expect(
        verifyReviewedEvidenceRunnerModule(root, head, descriptor)
      ).resolves.toMatchObject(descriptor);
      await writeFile(dependency, `${dependencyBytes}\n// changed\n`);
      await expect(
        verifyReviewedEvidenceRunnerModule(root, head, descriptor)
      ).rejects.toThrow('differs from the reviewed commit');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
