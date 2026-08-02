import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  access,
  mkdir,
  mkdtemp,
  rm,
  stat,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);
const modelSnapshotCommand = `readlink() { [ "$1" = -f ] && { [ "$2" = -- ] && printf '%s\\n' "$3" || printf '%s\\n' "$2"; return; }; /usr/bin/readlink "$@"; }; stat() { printf '1:2:0:0:700\\n'; }; findmnt() { printf '/ model ext4 ro\\n'; }; find() { case " $* " in *" ! -type f "*) printf 'd:700:0:0:%s\\n' "$STORE";; *) digest=$(/sbin/sha256sum "$STORE/blob" | /usr/bin/awk '{print $1}'); printf 'f:600:4:0:%s:%s  %s\\n' "$STORE/blob" "$digest" "$STORE/blob";; esac; }; STORE="$2"; init_temp_root; trap cleanup_temp EXIT; recovery_model_snapshot`;

function shell(command, args = []) {
  return execFileAsync('sh', [
    '-c',
    `. "$1"; SCRIPT_DIR=$(dirname "$1"); . "$SCRIPT_DIR/retire-ollama-recovery.sh"; ${command}`,
    'recovery-final-boundary-test',
    script.pathname,
    ...args,
  ]);
}

test('refuses a process and socket inventory that changes before receipt publication', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-cwv-final-process-'));
  const receipt = join(directory, 'receipt.json');
  try {
    await assert.rejects(
      shell(
        `root() { :; }; assert_docker_socket() { CANONICAL_DOCKER_SOCKET=/run/docker.sock; }; recovery_source_identity() { :; }; recovery_collect_systemd() { :; }; recovery_surface() { :; }; recovery_container_snapshot() { RECOVERY_CONTAINER_STATE=absent; printf '%s\\n' '{"name":"ollama-loopback","state":"absent"}'; }; recovery_docker() { [ "$1" = inspect ] || exit 79; printf 'Error: No such object: ollama-loopback\\n' >&2; return 1; }; calls=0; recovery_ps() { calls=$((calls + 1)); [ "$calls" -eq 1 ] || printf '41 1 /usr/bin/ollama serve\\n'; }; recovery_absent_process_snapshot() { if grep -q ollama "$1"; then /usr/bin/jq -cn '{state:"absent",matchingProcesses:[{pid:"41"}],listeningSockets:[{inode:"9"}],socketSnapshotSha256:"second"}'; else /usr/bin/jq -cn '{state:"absent",matchingProcesses:[],listeningSockets:[],socketSnapshotSha256:"first"}'; fi; }; recovery_collect_crontab() { : >"$1"; RECOVERY_EXTERNAL_CRON_SOURCES=$(temp_path); : >"$RECOVERY_EXTERNAL_CRON_SOURCES"; }; recovery_record_external_cron_sources() { :; }; recovery_package_snapshot() { /usr/bin/jq -cn '{state:"absent"}'; }; recovery_unit_snapshot() { /usr/bin/jq -cn --arg name "$1" '{name:$name,state:"absent"}'; }; recovery_model_snapshot() { /usr/bin/jq -cn '{state:"absent"}'; }; recovery_cron_snapshot() { /usr/bin/jq -cn '{wholeSha256:"test",lineCount:0,lines:[]}'; }; record_docker_socket() { :; }; recovery_write_receipt() { : >"$RECEIPT_MARKER"; }; RECEIPT_MARKER=$2; init_temp_root; recovery_scan`,
        [receipt]
      ),
      (error) =>
        error.code === 78 &&
        /recovery process or socket inventory changed before receipt publication/.test(
          error.stderr
        )
    );
    await assert.rejects(access(receipt));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('changes the model tree identity when same-size content is restored to its mtime', async () => {
  const directory = await mkdtemp('/private/tmp/baci-cwv-model-tree-');
  const store = join(directory, 'store');
  const blob = join(store, 'blob');
  try {
    await mkdir(store);
    await writeFile(blob, 'aaaa');
    const before = await stat(blob);
    const initial = JSON.parse(
      (await shell(modelSnapshotCommand, [store])).stdout
    );
    await writeFile(blob, 'bbbb');
    await utimes(blob, before.atime, before.mtime);
    const final = JSON.parse(
      (await shell(modelSnapshotCommand, [store])).stdout
    );
    assert.notEqual(initial.treeSha256, final.treeSha256);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
