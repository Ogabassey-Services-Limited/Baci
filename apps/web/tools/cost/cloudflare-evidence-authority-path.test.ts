import { chmod, mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertNoSymlinkAncestors } from './cloudflare-evidence-authority-path';

async function privateTempDir() {
  const directory = await mkdtemp(
    join(await realpath(tmpdir()), 'baci-authority-path-')
  );
  await chmod(directory, 0o700);
  return directory;
}

describe('authority path ancestry', () => {
  it('accepts a private non-symlink path', async () => {
    const directory = await privateTempDir();
    try {
      await mkdir(join(directory, 'nested'), { mode: 0o700 });
      await expect(
        assertNoSymlinkAncestors(
          join(directory, 'nested', 'authority.json'),
          'approval'
        )
      ).resolves.toBeUndefined();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects an intermediate symlink', async () => {
    const directory = await privateTempDir();
    try {
      await mkdir(join(directory, 'target'), { mode: 0o700 });
      await symlink(
        join(directory, 'target'),
        join(directory, 'linked'),
        'dir'
      );
      await expect(
        assertNoSymlinkAncestors(
          join(directory, 'linked', 'authority.json'),
          'approval'
        )
      ).rejects.toThrow('symlink');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
