import { readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const lockTokenPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const removePath = (path, unlink) => {
  try {
    unlink(path);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
};

const isLegacyArtifact = (entry, prefix) => {
  if (!entry.startsWith(prefix)) return false;
  const suffix = entry.slice(prefix.length);
  return (
    (suffix.startsWith('owner-') && lockTokenPattern.test(suffix.slice(6))) ||
    suffix === 'reclaim-ownerless' ||
    (suffix.startsWith('reclaim-') && lockTokenPattern.test(suffix.slice(8)))
  );
};

export function removeLegacyRemediationLockArtifacts(lockPath, unlink) {
  removePath(lockPath, unlink);
  const prefix = `${basename(lockPath)}.`;
  let entries;
  try {
    entries = readdirSync(dirname(lockPath));
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  for (const entry of entries) {
    if (isLegacyArtifact(entry, prefix))
      removePath(join(dirname(lockPath), entry), unlink);
  }
}
