import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);

function shell(command, env = {}, args = []) {
  return execFileAsync(
    'sh',
    [
      '-c',
      `. "$1"; SCRIPT_DIR=$(dirname "$1"); RECOVERY_HELPER="$SCRIPT_DIR/retire-ollama-recovery.sh"; . "$RECOVERY_HELPER"; [ -z "\${RETIRE_OLLAMA_RECOVERY_TEST_ROOT:-}" ] || RECOVERY_RECEIPT_ROOT="\${RETIRE_OLLAMA_RECOVERY_TEST_ROOT:-}"; ${command}`,
      'recovery-systemd-test',
      script.pathname,
      ...args,
    ],
    { env: { ...process.env, ...env } }
  );
}

test('rejects a root recovery helper outside the sealed source root', async () => {
  if (process.getuid?.() !== 0) return;
  const sourceSha = 'a'.repeat(40);
  await assert.rejects(
    shell(
      `SCRIPT_DIR="/tmp/${sourceSha}"; recovery_source_identity "${sourceSha}"`
    ),
    (error) => error.code === 1
  );
});

test('classifies Ollama crontab consumers in recovery evidence', async () => {
  const { stdout } = await shell(
    'RECOVERY_RECORDS="[]"; deps="[]"; consumer_counts="[]"; consumer_evidence="[]"; init_temp_root; trap cleanup_temp EXIT; cron=$(temp_path); printf "%s\\n%s\\n" "0 * * * * /usr/bin/ollama serve" "0 * * * * /usr/bin/other" >"$cron"; recovery_surface current-crontab cat "$cron"; printf "%s\\n%s\\n" "$consumer_counts" "$consumer_evidence"'
  );
  const [counts, evidence] = stdout.trim().split('\n').map(JSON.parse);
  assert.deepEqual(counts, [{ surface: 'current-crontab', matchCount: 1 }]);
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].surface, 'current-crontab');
});

test('rejects Ollama subcommand prefixes without a token boundary', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-ollama-recovery-argv-'));
  const processes = join(directory, 'processes');
  const ports = join(directory, 'ports.json');
  const command =
    'recovery_process_identity() { printf "container-cgroup container-ns\\n"; }; recovery_process_executable() { printf "{\\"path\\":\\"/usr/bin/ollama\\",\\"sha256\\":\\"%064d\\",\\"identitySha256\\":\\"%064d\\",\\"uid\\":\\"1000\\",\\"startTime\\":\\"1\\",\\"expected\\":\\"/bin/ollama\\"}\\n" 0 0; }; init_temp_root; trap cleanup_temp EXIT; recovery_process_snapshot 41 container-cgroup container-ns "$2" "$3"';
  try {
    await writeFile(ports, '{}\n');
    for (const subcommand of ['serve-malicious', 'runner-malicious']) {
      await writeFile(processes, `41 1 /usr/bin/ollama ${subcommand}\n`);
      await assert.rejects(
        shell(command, {}, [ports, processes]),
        (error) =>
          error.code === 78 && /unsupported Ollama process/.test(error.stderr)
      );
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

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

test('retains parsed unit activity and enablement states in recovery evidence', async () => {
  const bin = await testBin();
  try {
    const { stdout } = await shell(
      'recovery_systemctl() { case "$2" in ollama.service) printf "LoadState=loaded\\nUnitFileState=enabled\\nActiveState=active\\n";; ollama-watchdog.timer) printf "LoadState=loaded\\nUnitFileState=disabled\\nActiveState=inactive\\n";; esac; }; init_temp_root; trap cleanup_temp EXIT; recovery_unit_snapshot ollama.service; recovery_unit_snapshot ollama-watchdog.timer',
      { RETIRE_OLLAMA_TEST_BIN: bin }
    );
    const [active, inactive] = stdout.trim().split('\n').map(JSON.parse);
    assert.equal(active.name, 'ollama.service');
    assert.equal(active.state, 'present');
    assert.equal(active.loadState, 'loaded');
    assert.equal(active.unitFileState, 'enabled');
    assert.equal(active.activeState, 'active');
    assert.match(active.stateSha256, /^[0-9a-f]{64}$/);
    assert.equal(inactive.unitFileState, 'disabled');
    assert.equal(inactive.activeState, 'inactive');
  } finally {
    await rm(bin, { recursive: true, force: true });
  }
});
