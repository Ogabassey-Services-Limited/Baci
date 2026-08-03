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

function scanContainer(directory, option) {
  return execFileAsync('sh', [
    '-c',
    `${prelude}option=$3; docker() { case "$*" in *' ps -a '*) printf 'generic-api\\n' ;; *'inspect -f {{.Name}} generic-api') printf '/generic-api\\n' ;; *'inspect -f {{json .State.Running}} generic-api') printf 'false\\n' ;; *'inspect -f {{.Id}} '*) printf 'generic-api /generic-api /opt/application-wrapper [] [] {} null [] {} {} {} [] "bridge"\\n' ;; *'inspect -f {{json .Mounts}} generic-api') printf '[]\\n' ;; *' cp generic-api:/opt/application-wrapper '*) for destination do :; done; printf '#!/bin/sh\\nexec /opt/application-worker %s\\n' "$option" >"$destination" ;; *' cp generic-api:/opt/application-worker '*) for destination do :; done; printf '#!/bin/sh\\nexit 0\\n' >"$destination" ;; *' cp generic-api:/etc/application.conf '*) for destination do :; done; printf 'endpoint=http://127.0.0.1:11434\\n' >"$destination" ;; *) return 2 ;; esac; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); RETIRE_OLLAMA_TMPDIR="$2"; init_temp_root; trap cleanup_temp EXIT; CANONICAL_DOCKER_SOCKET=/run/docker.sock; CONTAINER=ollama-loopback; scan_container_rows all`,
    'retire-ollama-container-wrapper-option-test',
    script.pathname,
    directory,
    option,
  ]);
}

test('binds an endpoint file embedded in a stopped wrapper option', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-container-wrapper-option-'))
  );
  try {
    const { stdout } = await scanContainer(
      directory,
      '-c=/etc/application.conf'
    );
    const records = stdout.trim().split('\n');
    assert.equal(records.length, 3);
    assert.match(records[0], /application-wrapper/);
    assert.match(records[1], /application-worker/);
    assert.match(records[2], /application\.conf/);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('fails closed on an unsafe stopped wrapper option path', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-container-wrapper-unsafe-option-'))
  );
  try {
    await assert.rejects(
      scanContainer(directory, '-c=/tmp/../application.conf'),
      (error) => error.code === 2
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
