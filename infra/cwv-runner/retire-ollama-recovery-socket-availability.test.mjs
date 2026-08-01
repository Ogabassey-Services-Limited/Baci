import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);

function shell(command, args = []) {
  return execFileAsync('sh', [
    '-c',
    `. "$1"; SCRIPT_DIR=$(dirname "$1"); RECOVERY_HELPER="$SCRIPT_DIR/retire-ollama-recovery.sh"; . "$RECOVERY_HELPER"; ${command}`,
    'recovery-socket-availability-test',
    script.pathname,
    ...args,
  ]);
}

test('fails closed when recovery socket tables are unavailable', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'baci-ollama-recovery-no-net-')
  );
  try {
    await assert.rejects(
      shell(
        'RECOVERY_PROC_ROOT="$2"; init_temp_root; trap cleanup_temp EXIT; recovery_socket_snapshot "" "" "" "" /dev/null',
        [directory]
      ),
      (error) =>
        error.code === 78 &&
        /recovery socket directory unavailable/.test(error.stderr)
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
