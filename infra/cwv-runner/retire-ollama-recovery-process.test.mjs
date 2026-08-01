import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);

function shell(command, args = [], env = {}) {
  return execFileAsync(
    'sh',
    [
      '-c',
      `. "$1"; SCRIPT_DIR=$(dirname "$1"); RECOVERY_HELPER="$SCRIPT_DIR/retire-ollama-recovery.sh"; . "$RECOVERY_HELPER"; [ -z "\${RETIRE_OLLAMA_RECOVERY_TEST_ROOT:-}" ] || RECOVERY_RECEIPT_ROOT="\${RETIRE_OLLAMA_RECOVERY_TEST_ROOT:-}"; ${command}`,
      'retire-ollama-recovery-process-test',
      script.pathname,
      ...args,
    ],
    { env: { ...process.env, ...env } }
  );
}

test('classifies residual and held dpkg package states', async () => {
  const { stdout } = await shell(
    "recovery_dpkg_query() { printf 'rc  0.1\\n'; }; init_temp_root; trap cleanup_temp EXIT; recovery_package_snapshot"
  );
  assert.deepEqual(JSON.parse(stdout), {
    name: 'ollama',
    state: 'absent',
    version: null,
  });
  const held = await shell(
    "recovery_dpkg_query() { printf 'hi  0.1\\n'; }; init_temp_root; trap cleanup_temp EXIT; recovery_package_snapshot"
  );
  assert.equal(JSON.parse(held.stdout).state, 'present');
});

test('uses one saved process surface instead of invoking ps twice', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'baci-recovery-process-surface-')
  );
  const processes = join(directory, 'processes');
  try {
    const { stdout } = await shell(
      'calls=0; recovery_ps() { calls=$((calls + 1)); if [ "$calls" -eq 1 ]; then printf first; else printf changed; fi; }; recovery_surface() { class=$1; shift; [ "$class" = running-processes ] && "$@"; }; recovery_collect_processes "$2"; printf "\\n%s\\n" "$calls"',
      [processes]
    );
    assert.equal(stdout, 'first\n1\n');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('records post-action absent container and model states without identities', async () => {
  const container = JSON.parse(
    (
      await shell(
        'recovery_docker() { case "$1" in inspect) printf "Error: No such object: ollama-loopback\\n" >&2; return 1;; ps) :;; esac; }; init_temp_root; trap cleanup_temp EXIT; recovery_container_snapshot'
      )
    ).stdout
  );
  const model = JSON.parse(
    (
      await shell(
        'STORE=/missing/ollama; init_temp_root; trap cleanup_temp EXIT; recovery_model_snapshot'
      )
    ).stdout
  );
  assert.deepEqual(container, { name: 'ollama-loopback', state: 'absent' });
  assert.deepEqual(model, { state: 'absent' });
});

test('records a stopped container with inspect identity and checks absent processes', async () => {
  const inspected = JSON.stringify({
    Name: '/ollama-loopback',
    Id: 'b'.repeat(64),
    Image: `sha256:${'c'.repeat(64)}`,
    State: { Running: false, Pid: 0 },
    Path: '/bin/ollama',
    Config: { Env: ['OLLAMA_HOST=http://127.0.0.1:11434'] },
    HostConfig: { PortBindings: { '11434/tcp': [] } },
    Mounts: [],
    NetworkSettings: { Networks: {} },
  });
  const { stdout } = await shell(
    `recovery_docker() { printf '%s\\n' '${inspected}'; }; init_temp_root; trap cleanup_temp EXIT; recovery_container_snapshot`
  );
  const snapshot = JSON.parse(stdout);
  assert.equal(snapshot.state, 'stopped');
  assert.equal(snapshot.fullId, 'b'.repeat(64));
  assert.equal(snapshot.imageId, `sha256:${'c'.repeat(64)}`);
  assert.equal(snapshot.pid, '0');
  assert.match(snapshot.configSha256, /^[0-9a-f]{64}$/);
  assert.match(snapshot.portsSha256, /^[0-9a-f]{64}$/);
});

test('rejects a lingering Ollama process after container removal', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'baci-recovery-absent-process-')
  );
  const processes = join(directory, 'processes');
  try {
    for (const command of ['/usr/bin/ollama serve', 'ollama serve', 'ollama']) {
      await writeFile(processes, `41 1 ${command}\n`);
      await assert.rejects(
        shell(
          'init_temp_root; trap cleanup_temp EXIT; recovery_absent_process_snapshot "$2"',
          [processes]
        ),
        (error) =>
          error.code === 78 &&
          /foreign Ollama process remains/.test(error.stderr)
      );
    }
    await writeFile(processes, '41 1 /usr/bin/other-service\n');
    const { stdout } = await shell(
      'init_temp_root; trap cleanup_temp EXIT; recovery_absent_process_snapshot "$2"',
      [processes]
    );
    const snapshot = JSON.parse(stdout);
    assert.equal(snapshot.state, 'absent');
    assert.deepEqual(snapshot.matchingProcesses, []);
    assert.deepEqual(snapshot.listeningSockets, []);
    assert.match(snapshot.socketSnapshotSha256, /^[0-9a-f]{64}$/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects an Ollama executable even when it is a scanner ancestor', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'baci-recovery-absent-ancestor-')
  );
  const processes = join(directory, 'processes');
  try {
    await writeFile(processes, '41 1 /usr/bin/ollama serve\n');
    await assert.rejects(
      shell(
        'init_temp_root; trap cleanup_temp EXIT; RECOVERY_SCANNER_PID_SET=" 41 "; recovery_absent_process_snapshot "$2"',
        [processes]
      ),
      (error) =>
        error.code === 78 && /foreign Ollama process remains/.test(error.stderr)
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('parses authentic installed dpkg status bytes without a leading version space', async () => {
  const { stdout } = await shell(
    "recovery_dpkg_query() { printf 'ii  0.1\\n'; }; init_temp_root; trap cleanup_temp EXIT; recovery_package_snapshot"
  );
  assert.deepEqual(JSON.parse(stdout), {
    name: 'ollama',
    state: 'present',
    version: '0.1',
  });
});
