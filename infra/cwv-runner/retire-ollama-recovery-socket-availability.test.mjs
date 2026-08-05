import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);
const syntheticCredentials =
  process.getuid?.() === 0 ? { gid: 65534, uid: 65534 } : {};

function shell(command, args = [], env = {}, options = {}) {
  return execFileAsync(
    'sh',
    [
      '-c',
      `. "$1"; SCRIPT_DIR=$(dirname "$1"); RECOVERY_HELPER="$SCRIPT_DIR/retire-ollama-recovery.sh"; . "$RECOVERY_HELPER"; ${command}`,
      'recovery-socket-availability-test',
      script.pathname,
      ...args,
    ],
    { env: { ...process.env, ...env }, ...options }
  );
}

function syntheticShell(command, args = [], env = {}) {
  return shell(
    command,
    args,
    { ...env, RETIRE_OLLAMA_TEST_BIN: '/usr/bin' },
    syntheticCredentials
  );
}

test('fails closed when recovery socket tables are unavailable', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'baci-ollama-recovery-no-net-')
  );
  try {
    await chmod(directory, 0o755);
    await assert.rejects(
      syntheticShell(
        '[ "$RECOVERY_PROC_ROOT" = "$2" ] || exit 79; init_temp_root; trap cleanup_temp EXIT; recovery_socket_snapshot "" "" "" "" /dev/null',
        [directory],
        { RETIRE_OLLAMA_PROC_ROOT: directory }
      ),
      (error) =>
        error.code === 78 &&
        /recovery socket directory unavailable/.test(error.stderr)
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects a proc net symlink under an overridden root', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'baci-ollama-recovery-net-link-')
  );
  try {
    await mkdir(join(directory, 'self', 'net'), { recursive: true });
    await Promise.all(
      [directory, join(directory, 'self'), join(directory, 'self', 'net')].map(
        (path) => chmod(path, 0o755)
      )
    );
    await symlink('self/net', join(directory, 'net'));
    await assert.rejects(
      syntheticShell(
        '[ "$RECOVERY_PROC_ROOT" = "$2" ] || exit 79; init_temp_root; trap cleanup_temp EXIT; recovery_socket_snapshot "" "" "" "" /dev/null',
        [directory],
        { RETIRE_OLLAMA_PROC_ROOT: directory }
      ),
      (error) =>
        error.code === 78 &&
        /unsafe recovery socket directory/.test(error.stderr)
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('ignores a caller proc-root override for privileged recovery', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-ollama-root-proc-'));
  try {
    const { stdout } = await shell(
      'printf "%s\\n" "$(recovery_proc_root_for_uid 0 "$2")" "$(recovery_proc_root_for_uid 1000 "$2")"',
      [directory]
    );
    assert.deepEqual(stdout.trim().split('\n'), ['/proc', directory]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('accepts the canonical Linux proc net symlink', {
  skip: process.platform !== 'linux',
}, async () => {
  const { stdout } = await shell(
    'RECOVERY_PROC_ROOT=/proc; init_temp_root; trap cleanup_temp EXIT; recovery_socket_snapshot "" "" "" "" /dev/null; printf "%s\\n" "$RECOVERY_LISTENING_SOCKETS"'
  );
  assert.equal(stdout.trim(), '[]');
});
