import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:net';
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

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'baci-process-races-'));
  const proc = join(directory, 'proc');
  const processRoot = join(proc, '41');
  const executable = join(directory, 'generic-worker');
  const processFilesystem = join(directory, 'process-root');
  const processWorkingDirectory = join(processFilesystem, 'work');
  await mkdir(join(processRoot, 'ns'), { recursive: true });
  await mkdir(processFilesystem);
  await mkdir(processWorkingDirectory);
  await chmod(processFilesystem, 0o755);
  await chmod(processWorkingDirectory, 0o755);
  await writeFile(executable, '#!/bin/sh\n# http://127.0.0.1:11434\nexit 0\n');
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
  await symlink(processFilesystem, join(processRoot, 'root'));
  await symlink(processWorkingDirectory, join(processRoot, 'cwd'));
  await chmod(directory, 0o755);
  await chmod(proc, 0o755);
  await chmod(processRoot, 0o755);
  return { directory, proc, processFilesystem, processRoot };
}

function shell(proc, command, options = {}) {
  return execFileAsync(
    'sh',
    [
      '-c',
      `sha256sum() { if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$@"; else /usr/bin/sha256sum "$@"; fi; }; stat() { for path do :; done; if /usr/bin/stat --version >/dev/null 2>&1; then /usr/bin/stat -Lc '%d:%i:%u:%g:%a:%s' "$path"; else /usr/bin/stat -f '%d:%i:%u:%g:%Lp:%z' "$path"; fi; }; readlink() { option=$1; for path do :; done; if [ "$option" = -f ]; then realpath "$path"; else command readlink "$path"; fi; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); . "$SCRIPT_DIR/retire-ollama-recovery.sh"; init_temp_root; trap cleanup_temp EXIT; ${command}`,
      'retire-ollama-process-files-races-test',
      script,
    ],
    {
      ...childCredentials,
      ...options,
      env: {
        ...process.env,
        RETIRE_OLLAMA_PROC_ROOT: proc,
        RETIRE_OLLAMA_TEST_BIN: process.env.PATH,
      },
    }
  );
}

async function inventoryScan(proc, processes, identity, prefix = '') {
  const { stdout } = await shell(
    proc,
    `${prefix} APPROVED_OLLAMA_PID=41; APPROVED_OLLAMA_PROCESS_IDENTITY=${identity}; consumer_counts=$(jq -cn '[{surface:"running-processes",matchCount:0}]'); deps='[]'; consumer_evidence='[]'; record_running_process_files "${processes}"; jq -cn --argjson counts "$consumer_counts" --argjson deps "$deps" '{counts:$counts,deps:$deps}'`
  );
  return JSON.parse(stdout);
}

test('binds the approved Ollama skip to the exact live process identity', async () => {
  const { directory, proc } = await fixture();
  const processes = join(directory, 'processes');
  await writeFile(
    processes,
    'PID PPID USER COMMAND\n41 1 ollama /usr/bin/ollama serve\n'
  );
  try {
    const exact = await inventoryScan(
      proc,
      processes,
      '$(recovery_process_lifetime_marker 41)'
    );
    assert.equal(exact.counts[0].matchCount, 0);
    assert.deepEqual(exact.deps, []);
    const reused = await inventoryScan(proc, processes, '0'.repeat(64));
    assert.equal(reused.counts[0].matchCount, 1);
    assert.equal(reused.deps.length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('scans sealed normalized rows after the source inventory mutates', async () => {
  const { directory, proc } = await fixture();
  const processes = join(directory, 'processes');
  await writeFile(
    processes,
    'PID PPID USER COMMAND\n41 1 nobody /usr/bin/generic-worker --quiet\n'
  );
  try {
    const prefix = `awk_calls=0; awk() { awk_calls=$((awk_calls + 1)); command awk "$@"; status=$?; if [ "$awk_calls" -eq 1 ]; then printf 'PID PPID USER COMMAND\\n' >"${processes}"; fi; return "$status"; };`;
    const result = await inventoryScan(proc, processes, "''", prefix);
    assert.equal(result.counts[0].matchCount, 1);
    assert.equal(result.deps.length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('refuses a path substituted after the source-derived helper opens its descriptor', async () => {
  const { directory, proc, processFilesystem, processRoot } = await fixture();
  const configuration = join(processFilesystem, 'application.conf');
  const replacement = join(processFilesystem, 'replacement.conf');
  await chmod(processFilesystem, 0o777);
  await writeFile(configuration, 'endpoint=http://127.0.0.1:11434\n');
  await writeFile(replacement, 'endpoint=http://127.0.0.1:8080\n');
  await writeFile(
    join(processRoot, 'cmdline'),
    '/usr/bin/generic-worker\0--config=/application.conf\0'
  );
  try {
    const processFileModule = join(
      dirname(script),
      'retire-ollama-process-files.sh'
    );
    const instrumentedModule = join(directory, 'process-files-race.sh');
    const source = await readFile(processFileModule, 'utf8');
    const boundary = 'if (sysopen($file, $candidate, $flags)) {';
    const instrumented = source.replace(
      boundary,
      `${boundary}\n      exit 2 unless rename($ENV{PROCESS_FILE_RACE_REPLACEMENT}, $candidate);`
    );
    assert.notEqual(instrumented, source);
    await writeFile(instrumentedModule, instrumented);
    await assert.rejects(
      shell(
        proc,
        `. "${instrumentedModule}"; PROCESS_FILE_RACE_REPLACEMENT=${replacement} recovery_process_file_evidence 41`
      ),
      (error) =>
        error.code === 78 &&
        /process file argument descriptor failed/.test(error.stderr)
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('accepts a defined zero result from Darwin F_GETPATH', async () => {
  const { directory, proc, processFilesystem } = await fixture();
  const configuration = join(processFilesystem, 'application.conf');
  await writeFile(configuration, 'endpoint=http://127.0.0.1:11434\n');
  try {
    const processFileModule = join(
      dirname(script),
      'retire-ollama-process-files.sh'
    );
    const instrumentedModule = join(directory, 'process-files-fgetpath.sh');
    const source = await readFile(processFileModule, 'utf8');
    const instrumented = source
      .replace(
        'use strict; use warnings;',
        'BEGIN { *CORE::GLOBAL::fcntl = sub { $_[2] = $ENV{PROCESS_FILE_FGETPATH_RESULT} . "\\0"; return 0; }; } use strict; use warnings;'
      )
      .replace('if ($^O eq "linux") {', 'if (0) {')
      .replace('} elsif ($^O eq "darwin") {', '} elsif (1) {');
    assert.notEqual(instrumented, source);
    await writeFile(instrumentedModule, instrumented);

    const { stdout } = await shell(
      proc,
      `. "${instrumentedModule}"; export PROCESS_FILE_FGETPATH_RESULT=${configuration}; recovery_open_process_file "${configuration}" "${processFilesystem}"`
    );
    const descriptor = JSON.parse(stdout);
    assert.equal(descriptor.realPath, configuration);
    assert.equal(descriptor.match, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('promptly refuses a FIFO environment candidate without opening it blocking', async () => {
  const { directory, proc, processFilesystem, processRoot } = await fixture();
  const fifo = join(processFilesystem, 'ollama.pipe');
  await execFileAsync('mkfifo', [fifo]);
  await writeFile(join(processRoot, 'environ'), 'CONFIG=/ollama.pipe\0');
  try {
    await assert.rejects(
      shell(proc, 'recovery_process_file_evidence 41', { timeout: 2000 }),
      (error) =>
        error.code === 78 &&
        error.killed === false &&
        /process file argument descriptor failed/.test(error.stderr)
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('skips a socket-valued environment path but refuses the same socket in argv', async () => {
  const { directory, proc, processFilesystem, processRoot } = await fixture();
  const socket = join(processFilesystem, 'agent.sock');
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(socket, resolve);
  });
  try {
    await writeFile(
      join(processRoot, 'environ'),
      'SSH_AUTH_SOCK=/agent.sock\0'
    );
    const { stdout } = await shell(proc, 'recovery_process_file_evidence 41');
    assert.deepEqual(JSON.parse(stdout).fileArguments, []);

    await writeFile(join(processRoot, 'environ'), 'PATH=/usr/bin\0');
    await writeFile(
      join(processRoot, 'cmdline'),
      '/usr/bin/generic-worker\0--socket=/agent.sock\0'
    );
    await assert.rejects(
      shell(proc, 'recovery_process_file_evidence 41'),
      (error) =>
        error.code === 78 &&
        /process file argument is a special target/.test(error.stderr)
    );
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
    await rm(directory, { recursive: true, force: true });
  }
});
