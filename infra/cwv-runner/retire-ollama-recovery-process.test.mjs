import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);

async function shell(command, args = [], env = {}) {
  const procRoot = await mkdtemp(join(tmpdir(), 'baci-recovery-proc-'));
  await mkdir(join(procRoot, 'net'));
  await Promise.all(
    ['tcp', 'tcp6'].map((name) =>
      writeFile(
        join(procRoot, 'net', name),
        'sl local_address rem_address st tx_queue tr tm->when retrnsmt uid timeout inode\n'
      )
    )
  );
  return execFileAsync(
    'sh',
    [
      '-c',
      `. "$1"; SCRIPT_DIR=$(dirname "$1"); RECOVERY_HELPER="$SCRIPT_DIR/retire-ollama-recovery.sh"; . "$RECOVERY_HELPER"; [ -z "\${RETIRE_OLLAMA_RECOVERY_TEST_ROOT:-}" ] || RECOVERY_RECEIPT_ROOT="\${RETIRE_OLLAMA_RECOVERY_TEST_ROOT:-}"; ${command}`,
      'retire-ollama-recovery-process-test',
      script.pathname,
      ...args,
    ],
    { env: { ...process.env, RETIRE_OLLAMA_PROC_ROOT: procRoot, ...env } }
  ).finally(() => rm(procRoot, { recursive: true, force: true }));
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

test('records valid partial and reinst-required dpkg states explicitly', async () => {
  for (const packageOutput of ['iU  0.1', 'iHR 0.1', 'iiR 0.1']) {
    const { stdout } = await shell(
      `recovery_dpkg_query() { printf '${packageOutput}\\n'; }; init_temp_root; trap cleanup_temp EXIT; recovery_package_snapshot`
    );
    assert.deepEqual(JSON.parse(stdout), {
      name: 'ollama',
      state: 'partial',
      statusAbbrev: packageOutput.slice(0, 3),
      version: '0.1',
    });
  }
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

test('rejects foreign scanner substrings, mismatched proxy tuples, and proxy-only evidence', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'baci-ollama-recovery-process-hardening-')
  );
  const processes = join(directory, 'processes');
  const ports = join(directory, 'ports.json');
  const identity =
    'recovery_process_identity() { printf "cgroup namespace\\n"; }; recovery_process_executable() { printf "{\\"path\\":\\"/usr/bin/%s\\",\\"sha256\\":\\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\\",\\"identitySha256\\":\\"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\\",\\"uid\\":\\"0\\",\\"startTime\\":\\"1\\",\\"expected\\":\\"%s\\"}\\n" "$2" "$2"; }; init_temp_root; trap cleanup_temp EXIT; recovery_process_snapshot 40 cgroup namespace "$2" "$3"';
  try {
    await writeFile(
      ports,
      '{"NetworkSettings":{"Ports":{"11434/tcp":[{"HostIp":"127.0.0.1","HostPort":"11434"}]},"Networks":{"bridge":{"IPAddress":"172.17.0.2"}}}}\n'
    );
    await writeFile(processes, '41 1 /usr/bin/ollama serve\n');
    await assert.rejects(
      shell(identity, [ports, processes]),
      (error) =>
        error.code === 78 &&
        /inspected container process missing/.test(error.stderr)
    );
    await writeFile(
      processes,
      '41 1 /bin/sh /sealed/retire-ollama.sh --recovery-scan\n'
    );
    await assert.rejects(
      shell(`RECOVERY_SELF_PID=99; ${identity}`, [ports, processes]),
      (error) =>
        error.code === 78 && /foreign Ollama process/.test(error.stderr)
    );
    await writeFile(
      processes,
      '41 1 /usr/bin/ollama serve\n42 1 /usr/bin/docker-proxy -proto tcp -host-ip 127.0.0.1 -host-port 11434 -container-ip 172.17.0.3 -container-port 11434\n'
    );
    await assert.rejects(
      shell(identity, [ports, processes]),
      (error) => error.code === 78 && /Docker proxy/.test(error.stderr)
    );
    await writeFile(
      processes,
      '42 1 /usr/bin/docker-proxy -proto tcp -host-ip 127.0.0.1 -host-port 11434 -container-ip 172.17.0.2 -container-port 11434\n'
    );
    await assert.rejects(
      shell(identity, [ports, processes]),
      (error) => error.code === 78 && /incomplete reviewed/.test(error.stderr)
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
