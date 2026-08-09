import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';

const HELD_ENV = 'BACI_REMEDIATION_GLOBAL_FLOCK_HELD';
const DEFAULT_LOCK_PATH = 'locks/error-remediator-global.lock';

export function ensureRemediationGlobalLock({
  env = process.env,
  runner = spawnSync,
  scriptPath,
} = {}) {
  if (!scriptPath) throw new Error('scriptPath is required');
  if (env[HELD_ENV] === '1') return false;
  const lockPath = env.BACI_REMEDIATION_GLOBAL_LOCK_PATH
    ? resolve(env.BACI_REMEDIATION_GLOBAL_LOCK_PATH)
    : resolve(dirname(scriptPath), '..', DEFAULT_LOCK_PATH);
  const result = runner(
    'flock',
    ['-n', lockPath, 'env', `${HELD_ENV}=1`, process.execPath, scriptPath],
    { env, stdio: 'inherit' }
  );
  if (result.error) throw result.error;
  if (![0, 1].includes(result.status)) {
    throw new Error(`global remediation flock exited with ${result.status}`);
  }
  return true;
}
