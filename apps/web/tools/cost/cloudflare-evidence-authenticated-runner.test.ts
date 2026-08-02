import { createHash } from 'node:crypto';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyAuthenticatedEvidenceRunnerModule } from './cloudflare-evidence-authenticated-runner';

async function fixture(source: string) {
  const root = await realpath(await mkdtemp(`${tmpdir()}/baci-runner-`));
  const path = resolve(root, 'runner.ts');
  await writeFile(path, source);
  return {
    root,
    path,
    sha256: createHash('sha256').update(source).digest('hex'),
  };
}

describe('owner-authenticated Cloudflare evidence runner', () => {
  it('accepts an exact-hash closed adapter that was created after merge', async () => {
    const value = await fixture(
      'export function createMutationDependencies() { return {}; }\n'
    );
    try {
      await expect(
        verifyAuthenticatedEvidenceRunnerModule(value.root, value)
      ).resolves.toMatchObject({ path: value.path, sha256: value.sha256 });
    } finally {
      await rm(value.root, { recursive: true, force: true });
    }
  });

  it('rejects bytes that do not match the private owner approval', async () => {
    const value = await fixture('export const runner = 1;\n');
    try {
      await expect(
        verifyAuthenticatedEvidenceRunnerModule(value.root, {
          path: value.path,
          sha256: 'a'.repeat(64),
        })
      ).rejects.toThrow('owner approval');
    } finally {
      await rm(value.root, { recursive: true, force: true });
    }
  });

  it('rejects mutable local or package imports outside the approved file', async () => {
    for (const source of [
      "import './mutable-local';\nexport const runner = 1;\n",
      "import value from 'provider-sdk';\nexport { value };\n",
    ]) {
      const value = await fixture(source);
      try {
        await expect(
          verifyAuthenticatedEvidenceRunnerModule(value.root, value)
        ).rejects.toThrow('closed single-file import graph');
      } finally {
        await rm(value.root, { recursive: true, force: true });
      }
    }
  });
});
