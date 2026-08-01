import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);

function shell(command, env = {}) {
  return execFileAsync(
    'sh',
    [
      '-c',
      `. "$1"; SCRIPT_DIR=$(dirname "$1"); RECOVERY_HELPER="$SCRIPT_DIR/retire-ollama-recovery.sh"; . "$RECOVERY_HELPER"; ${command}`,
      'recovery-systemd-test',
      script.pathname,
    ],
    { env: { ...process.env, ...env } }
  );
}

async function testBin() {
  const directory = await mkdtemp(
    join(tmpdir(), 'baci-ollama-recovery-systemd-bin-')
  );
  await writeFile(
    join(directory, 'sha256sum'),
    '#!/bin/sh\nexec /usr/bin/shasum -a 256 "$@"\n'
  );
  await chmod(join(directory, 'sha256sum'), 0o755);
  return directory;
}

test('parses systemd EnvironmentFiles annotations and preserves optionality', async () => {
  const bin = await testBin();
  try {
    const { stdout } = await shell(
      'recovery_surface() { :; }; recovery_systemd_properties() { if [ "$2" = EnvironmentFiles ]; then printf "/etc/ollama-optional.env (ignore_errors=yes) /etc/ollama-required.env (ignore_errors=no)\\n" >"$3"; return 0; fi; : >"$3"; return 4; }; recovery_record_environment() { printf "%s:%s\\n" "$1" "$2"; }; RECOVERY_RECORDS="[]"; UNIT=ollama.service; TIMER=ollama-watchdog.timer; init_temp_root; trap cleanup_temp EXIT; recovery_collect_systemd',
      { RETIRE_OLLAMA_TEST_BIN: bin }
    );
    assert.deepEqual(stdout.trim().split('\n'), [
      '/etc/ollama-optional.env:1',
      '/etc/ollama-required.env:0',
      '/etc/ollama-optional.env:1',
      '/etc/ollama-required.env:0',
    ]);
  } finally {
    await rm(bin, { recursive: true, force: true });
  }
});

test('rejects unknown or contradictory systemd EnvironmentFiles annotations', async () => {
  const bin = await testBin();
  try {
    await assert.rejects(
      shell(
        'recovery_surface() { :; }; recovery_systemd_properties() { if [ "$2" = EnvironmentFiles ]; then printf "/etc/ollama.env (ignore_errors=maybe)\\n" >"$3"; return 0; fi; : >"$3"; return 4; }; recovery_record_environment() { :; }; RECOVERY_RECORDS="[]"; UNIT=ollama.service; TIMER=ollama-watchdog.timer; init_temp_root; trap cleanup_temp EXIT; recovery_collect_systemd',
        { RETIRE_OLLAMA_TEST_BIN: bin }
      ),
      (error) =>
        error.code === 65 &&
        /unknown recovery EnvironmentFiles annotation/.test(error.stderr)
    );
    await assert.rejects(
      shell(
        'recovery_surface() { :; }; recovery_systemd_properties() { if [ "$2" = EnvironmentFiles ]; then printf "%s\\n" "-/etc/ollama.env (ignore_errors=no)" >"$3"; return 0; fi; : >"$3"; return 4; }; recovery_record_environment() { :; }; RECOVERY_RECORDS="[]"; UNIT=ollama.service; TIMER=ollama-watchdog.timer; init_temp_root; trap cleanup_temp EXIT; recovery_collect_systemd',
        { RETIRE_OLLAMA_TEST_BIN: bin }
      ),
      (error) => error.code === 65 && /optionality drift/.test(error.stderr)
    );
  } finally {
    await rm(bin, { recursive: true, force: true });
  }
});
