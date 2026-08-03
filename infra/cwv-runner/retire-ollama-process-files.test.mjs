import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  chmod,
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = join(
  dirname(new URL(import.meta.url).pathname),
  'retire-ollama.sh'
);
const childCredentials =
  process.getuid?.() === 0 ? { gid: 65534, uid: 65534 } : {};

async function fixture(endpointInExecutable = true) {
  const directory = await mkdtemp(join(tmpdir(), 'baci-process-files-'));
  const proc = join(directory, 'proc');
  const processRoot = join(proc, '41');
  const executable = join(directory, 'generic-worker');
  await mkdir(join(processRoot, 'ns'), { recursive: true });
  await writeFile(
    executable,
    `#!/bin/sh\n# ${endpointInExecutable ? 'http://127.0.0.1:11434' : 'ordinary worker'}\nexit 0\n`
  );
  await chmod(executable, 0o755);
  await writeFile(join(processRoot, 'cgroup'), '0::/workers/generic\n');
  await writeFile(join(processRoot, 'ns', 'pid:[4026533000]'), '');
  await symlink('pid:[4026533000]', join(processRoot, 'ns', 'pid'));
  await writeFile(
    join(processRoot, 'status'),
    'Name:\tworker\nState:\tS (sleeping)\nUid:\t65534\t65534\t65534\t65534\nKthread:\t0\n'
  );
  await writeFile(
    join(processRoot, 'stat'),
    '41 (worker) S 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 77\n'
  );
  await writeFile(join(processRoot, 'environ'), 'PATH=/usr/bin\0');
  await writeFile(
    join(processRoot, 'cmdline'),
    '/usr/bin/generic-worker\0--quiet\0'
  );
  await symlink(executable, join(processRoot, 'exe'));
  await chmod(directory, 0o755);
  await chmod(proc, 0o755);
  await chmod(processRoot, 0o755);
  return { directory, proc };
}

function shell(proc, command) {
  return execFileAsync(
    'sh',
    [
      '-c',
      `sha256sum() { /usr/bin/shasum -a 256 "$@"; }; stat() { for path do :; done; /usr/bin/stat -f '%d:%i:%u:%g:%Lp:%z' "$path"; }; readlink() { for path do :; done; /usr/bin/readlink "$path"; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); . "$SCRIPT_DIR/retire-ollama-recovery.sh"; init_temp_root; trap cleanup_temp EXIT; ${command}`,
      'retire-ollama-process-files-test',
      script,
    ],
    {
      ...childCredentials,
      env: {
        ...process.env,
        RETIRE_OLLAMA_PROC_ROOT: proc,
        RETIRE_OLLAMA_TEST_BIN: process.env.PATH,
      },
    }
  );
}

test('fingerprints an idle generic executable whose bytes contain the Ollama endpoint', async () => {
  const { directory, proc } = await fixture();
  try {
    const { stdout } = await shell(proc, 'recovery_process_file_evidence 41');
    const evidence = JSON.parse(stdout);
    assert.match(evidence.executable.matchingSha256, /^[0-9a-f]{64}$/);
    assert.match(evidence.executable.identitySha256, /^[0-9a-f]{64}$/);
    assert.deepEqual(evidence.fileArguments, []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('recovery refuses an idle foreign process matched only by executable bytes', async () => {
  const { directory, proc } = await fixture();
  const processes = join(directory, 'processes');
  await writeFile(processes, '41 1 /usr/bin/generic-worker --quiet\n');
  try {
    await assert.rejects(
      shell(
        proc,
        `recovery_socket_snapshot() { RECOVERY_SOCKET_SNAPSHOT_SHA=$(printf empty | sha256sum | awk '{print $1}'); RECOVERY_LISTENING_SOCKETS='[]'; }; consumer_counts=$(jq -cn '[{surface:"running-processes",matchCount:0}]'); recovery_absent_process_snapshot "${processes}"`
      ),
      (error) =>
        error.code === 78 && /foreign Ollama process remains/.test(error.stderr)
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('destructive inventory classifies an idle foreign process matched only by executable bytes', async () => {
  const { directory, proc } = await fixture();
  const processes = join(directory, 'processes-with-user');
  await writeFile(
    processes,
    'PID PPID USER COMMAND\n41 1 nobody /usr/bin/generic-worker --quiet\n'
  );
  try {
    const { stdout } = await shell(
      proc,
      `consumer_counts=$(jq -cn '[{surface:"running-processes",matchCount:0}]'); deps='[]'; consumer_evidence='[]'; record_running_process_files "${processes}"; jq -cn --argjson counts "$consumer_counts" --argjson deps "$deps" '{counts:$counts,deps:$deps}'`
    );
    const result = JSON.parse(stdout);
    assert.equal(result.counts[0].matchCount, 1);
    assert.match(result.deps[0]['key-name'], /^running-processes:files:/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('does not classify stable generic executable bytes without an endpoint', async () => {
  const { directory, proc } = await fixture(false);
  try {
    const { stdout } = await shell(
      proc,
      'evidence=$(recovery_process_file_evidence 41); if recovery_process_files_match "$evidence"; then printf 0; else printf 1; fi'
    );
    assert.equal(stdout, '1');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
