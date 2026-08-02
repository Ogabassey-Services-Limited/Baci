import {
  chmod,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readAuthorityArtifact } from './cloudflare-evidence-authority-file';

async function privateTempDir() {
  const directory = await mkdtemp(
    join(await realpath(tmpdir()), 'baci-authority-file-')
  );
  await chmod(directory, 0o700);
  return directory;
}

describe('authority artifact reader', () => {
  it('reads JSON from the validated private file handle', async () => {
    const directory = await privateTempDir();
    const path = join(directory, 'authority.json');
    try {
      await writeFile(path, '{"approved":true}\n', { mode: 0o600 });
      await expect(readAuthorityArtifact(path, 'approval')).resolves.toEqual({
        approved: true,
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects a final symlink before reading substituted bytes', async () => {
    const directory = await privateTempDir();
    const target = join(directory, 'target.json');
    const path = join(directory, 'authority.json');
    try {
      await writeFile(target, '{"approved":true}\n', { mode: 0o600 });
      await symlink(target, path);
      await expect(readAuthorityArtifact(path, 'approval')).rejects.toThrow(
        'private regular file'
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
