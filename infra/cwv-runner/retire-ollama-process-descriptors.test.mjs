import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
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

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'baci-process-descriptors-'));
  const proc = join(directory, 'proc');
  const processRoot = join(proc, '41');
  const executable = join(directory, 'generic-worker');
  const processFilesystem = join(directory, 'process-root');
  const working = join(processFilesystem, 'work');
  await mkdir(join(processRoot, 'ns'), { recursive: true });
  await mkdir(join(processRoot, 'fd'));
  await mkdir(processFilesystem);
  await mkdir(working);
  await writeFile(executable, '#!/bin/sh\n# ordinary worker\nexit 0\n');
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
  await symlink(working, join(processRoot, 'cwd'));
  await Promise.all(
    [directory, proc, processRoot, processFilesystem, working].map((path) =>
      chmod(path, 0o755)
    )
  );
  return { directory, proc, processFilesystem, processRoot };
}

function shell(proc, command) {
  return execFileAsync(
    'sh',
    [
      '-c',
      `sha256sum() { if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$@"; else /usr/bin/sha256sum "$@"; fi; }; stat() { for path do :; done; if /usr/bin/stat --version >/dev/null 2>&1; then /usr/bin/stat -Lc '%d:%i:%u:%g:%a:%s' "$path"; else /usr/bin/stat -f '%d:%i:%u:%g:%Lp:%z' "$path"; fi; }; readlink() { option=$1; for path do :; done; if [ "$option" = -f ]; then realpath "$path"; else command readlink "$path"; fi; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); . "$SCRIPT_DIR/retire-ollama-recovery.sh"; init_temp_root; trap cleanup_temp EXIT; ${command}`,
      'retire-ollama-process-descriptors-test',
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

test('accepts false match values for clean regular process arguments', async () => {
  const { directory, proc, processFilesystem, processRoot } = await fixture();
  const configuration = join(processFilesystem, 'application.conf');
  await writeFile(configuration, 'endpoint=http://127.0.0.1:8080\n');
  await writeFile(
    join(processRoot, 'cmdline'),
    '/usr/bin/generic-worker\0--config=/application.conf\0'
  );
  try {
    const evidence = JSON.parse(
      (await shell(proc, 'recovery_process_file_evidence 41')).stdout
    );
    assert.equal(evidence.fileArguments.length, 1);
    assert.equal(evidence.fileArguments[0].matchingSha256, undefined);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('inspects endpoint-bearing regular files held open by a process', async () => {
  const { directory, proc, processFilesystem, processRoot } = await fixture();
  const configuration = join(processFilesystem, 'application.conf');
  const contents = 'endpoint=http://127.0.0.1:11434\n';
  await writeFile(configuration, contents);
  await symlink(configuration, join(processRoot, 'fd', '3'));
  try {
    const evidence = JSON.parse(
      (await shell(proc, 'recovery_process_file_evidence 41')).stdout
    );
    const descriptor = evidence.fileArguments.find(
      (entry) => entry.origin === 'descriptor'
    );
    assert.equal(descriptor.scope, 'fd');
    assert.equal(
      descriptor.matchingSha256,
      createHash('sha256').update(contents).digest('hex')
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
