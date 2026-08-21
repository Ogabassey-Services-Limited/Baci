import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);

async function runFixture(command) {
  const directory = await mkdtemp(join(tmpdir(), 'baci-running-archive-'));
  try {
    const { stdout } = await execFileAsync('sh', [
      '-c',
      `. "$1"; SCRIPT_DIR=$(dirname "$1"); RETIRE_OLLAMA_TMPDIR="$2"; init_temp_root; trap cleanup_temp EXIT; CANONICAL_DOCKER_SOCKET=/run/docker.sock; load_consumer_scanners; ${command}`,
      'running-archive-test',
      script.pathname,
      directory,
    ]);
    return stdout;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('keeps enforcing the deadline after archive output is complete', async () => {
  await assert.rejects(
    runFixture(
      'status="$2/status"; clock="$2/clock"; printf \'0\\n\' >"$status"; sleep 3 & sleeper=$!; running_container_now() { if [ -e "$clock" ]; then printf \'3\\n\'; else : >"$clock"; printf \'1\\n\'; fi; }; running_container_wait_group 2 "$sleeper" -- "$status"'
    ),
    (error) => error.code === 124
  );
});

test('rejects unknown archive command kinds without executing Docker', async () => {
  await assert.rejects(
    runFixture(
      'docker() { exit 91; }; running_container_archive_command unknown fixture'
    ),
    (error) => error.code === 2
  );
});
