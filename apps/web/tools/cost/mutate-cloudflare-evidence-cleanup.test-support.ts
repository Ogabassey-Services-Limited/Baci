import { chmod, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openEvidenceRun } from './cloudflare-evidence-run-journal';
import { mutationInput } from './mutate-cloudflare-evidence-test-fixtures';

export async function createCleanupRun() {
  const dir = await mkdtemp(join(tmpdir(), 'baci-evidence-'));
  await chmod(dir, 0o700);
  await openEvidenceRun(dir, mutationInput);
  return dir;
}
