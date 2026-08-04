import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);
const prelude =
  'sha256sum() { /usr/bin/shasum -a 256 "$@"; }; stat() { printf "1:2:81a4:10:0:0:600\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; ';

function scan(directory, entrypoint, workingDirectory = '/opt/application') {
  return execFileAsync('sh', [
    '-c',
    `${prelude}entrypoint=$3; working_directory=$4; docker() { case "$*" in *' ps -a '*) printf 'generic-api\\n' ;; *'inspect -f {{.Name}} generic-api') printf '/generic-api\\n' ;; *'inspect -f {{json .State.Running}} generic-api') printf 'false\\n' ;; *'inspect -f {{json .Config.WorkingDir}} generic-api') printf '%s\\n' "$working_directory" ;; *'inspect -f {{json .Args}} generic-api') printf '[]\\n' ;; *'inspect -f {{json .Mounts}} generic-api') printf '[]\\n' ;; *'inspect -f {{.Id}} '*) printf 'generic-api /generic-api %s [] [] %s {} null [] {} {} {} [] "bridge"\\n' "$entrypoint" "$working_directory" ;; *' cp generic-api:/opt/application/worker '*|*' cp generic-api:/worker '*) for destination do :; done; printf '#!/bin/sh\\ncurl http://127.0.0.1:11434\\n' >"$destination" ;; *) return 2 ;; esac; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); RETIRE_OLLAMA_TMPDIR="$2"; init_temp_root; trap cleanup_temp EXIT; CANONICAL_DOCKER_SOCKET=/run/docker.sock; CONTAINER=ollama-loopback; scan_container_rows all`,
    'retire-ollama-direct-entrypoint-test',
    script.pathname,
    directory,
    entrypoint,
    JSON.stringify(workingDirectory),
  ]);
}

test('resolves a stopped container dot-relative entrypoint from WorkingDir', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-container-entrypoint-'))
  );
  try {
    const { stdout } = await scan(directory, './worker');
    assert.match(
      stdout,
      /container-argument:generic-api:\/opt\/application\/worker/
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('resolves a dot-relative entrypoint from Docker default WorkingDir', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-container-entrypoint-root-'))
  );
  try {
    const { stdout } = await scan(directory, './worker', '');
    assert.match(stdout, /container-argument:generic-api:\/worker/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('fails closed rather than skipping a bare stopped-container entrypoint', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-container-entrypoint-bare-'))
  );
  try {
    await assert.rejects(
      scan(directory, 'worker'),
      (error) => error.code === 2
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
