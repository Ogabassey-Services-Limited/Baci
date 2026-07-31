import { execFile } from 'node:child_process';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const WORKSPACE_ROOT = path.resolve(import.meta.dirname, '../../../..');
const execFileAsync = promisify(execFile);

export function createReplayManifestTestWorkspace() {
  const temporaryRoots: string[] = [];

  return {
    workspaceRoot: WORKSPACE_ROOT,
    copyWorkspace: async (prefix = 'baci-replay-verifier-') => {
      const root = await mkdtemp(path.join(tmpdir(), prefix));
      temporaryRoots.push(root);
      await execFileAsync('git', [
        'clone',
        '--shared',
        '--no-checkout',
        WORKSPACE_ROOT,
        root,
      ]);
      await cp(
        path.join(WORKSPACE_ROOT, 'supabase/migrations'),
        path.join(root, 'supabase/migrations'),
        { recursive: true }
      );
      await cp(
        path.join(WORKSPACE_ROOT, 'supabase/tests/migration_history_overlays'),
        path.join(root, 'supabase/tests/migration_history_overlays'),
        { recursive: true }
      );
      await cp(
        path.join(WORKSPACE_ROOT, 'apps/web/tools/db/fixtures'),
        path.join(root, 'apps/web/tools/db/fixtures'),
        { recursive: true }
      );
      return root;
    },
    cleanUp: async () =>
      Promise.all(
        temporaryRoots
          .splice(0)
          .map((root) => rm(root, { force: true, recursive: true }))
      ),
  };
}
