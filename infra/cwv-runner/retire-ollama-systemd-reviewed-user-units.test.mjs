import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);

function assertFingerprint(record, definition) {
  const fields = record.split('|');
  assert.equal(fields[0], definition);
  assert.match(fields[1], /^[0-9a-f]{64}$/);
  assert.match(fields[2], /^[0-9a-f]{64}$/);
}

test('inventories stopped and live owner-user units named like the reviewed system service', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-reviewed-user-'))
  );
  const systemRoot = join(directory, 'system');
  const userHome = join(directory, 'home');
  const userRoot = join(userHome, '.config', 'systemd', 'user');
  const definition = join(userRoot, 'ollama.service');
  try {
    await Promise.all([
      mkdir(systemRoot),
      mkdir(userRoot, { recursive: true }),
    ]);
    await writeFile(
      definition,
      '[Service]\nEnvironment=OLLAMA_HOST=http://127.0.0.1:11434\n'
    );
    const { stdout } = await execFileAsync('sh', [
      '-c',
      'home=$3; getent() { printf "bassey:x:1001:1001::%s:/bin/sh\\n" "$home"; }; systemctl() { if [ "$1" = --user ]; then shift 2; case "$1" in list-unit-files) printf "ollama.service enabled\\n";; list-units) printf "ollama.service loaded active running test\\n";; show) printf "Environment=OLLAMA_HOST=http://127.0.0.1:11434\\nEnvironmentFiles=\\nStandardInput=null\\nExecStart={}\\n";; *) return 64;; esac; else case "$1" in list-unit-files|list-units) return 0;; *) return 64;; esac; fi; }; stat() { printf "1:2:81a4:10:501:20:644\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); SYSTEMD_ROOTS="$2"; load_consumer_scanners; systemd_user_roots() { [ "$1" = "1001:$home" ] || return 2; printf "%s\\n" "$home/.config/systemd/user"; }; systemd_user_manager_available() { return 0; }; init_temp_root; trap cleanup_temp EXIT; scan_systemd_consumers',
      'retire-ollama-reviewed-user-unit-test',
      script.pathname,
      systemRoot,
      userHome,
    ]);
    const records = stdout.trim().split('\n');
    assert.equal(records.length, 2);
    assertFingerprint(
      records.find((record) => record.startsWith(definition)),
      definition
    );
    assert.match(
      records.find((record) => record.startsWith('ollama.service:')),
      /^ollama\.service:[0-9a-f]{64}$/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
