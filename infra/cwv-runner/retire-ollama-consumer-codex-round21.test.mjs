import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);
const prelude =
  'sha256sum() { /usr/bin/shasum -a 256 "$@"; }; stat() { printf "1:2:81a4:10:0:0:600\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; ';

test('binds a stopped container healthcheck executable closure', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-container-healthcheck-closure-'))
  );
  try {
    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}docker() { case "$*" in *' ps -a '*) printf 'generic-api\\n' ;; *'inspect -f {{.Name}} generic-api') printf '/generic-api\\n' ;; *'inspect -f {{json .State.Running}} generic-api') printf 'false\\n' ;; *'inspect -f {{json .Config.Healthcheck}} generic-api') printf '{"Test":["CMD","/opt/application-healthcheck"]}\\n' ;; *'inspect -f {{.Id}} '*) printf 'generic-api /generic-api /bin/true [] [] {} {"Test":["CMD","/opt/application-healthcheck"]} [] {} {} {} [] "bridge"\\n' ;; *'inspect -f {{json .Mounts}} generic-api') printf '[]\\n' ;; *' cp generic-api:/bin/true '*) for destination do :; done; printf '#!/bin/sh\\nexit 0\\n' >"$destination" ;; *' cp generic-api:/opt/application-healthcheck '*) for destination do :; done; printf '#!/bin/sh\\ncurl http://127.0.0.1:11434\\n' >"$destination" ;; *) return 2 ;; esac; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); RETIRE_OLLAMA_TMPDIR="$2"; init_temp_root; trap cleanup_temp EXIT; CANONICAL_DOCKER_SOCKET=/run/docker.sock; CONTAINER=ollama-loopback; scan_container_rows all`,
      'retire-ollama-container-healthcheck-closure-test',
      script.pathname,
      directory,
    ]);
    assert.match(
      stdout,
      /container-argument:generic-api:\/opt\/application-healthcheck/
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

function scanCompose(root) {
  return execFileAsync('sh', [
    '-c',
    `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); COMPOSE_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_compose_definitions`,
    'retire-ollama-compose-default-expansion-test',
    script.pathname,
    root,
  ]);
}

test('binds a Compose endpoint assembled from interpolation defaults', async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-compose-default-expansion-'))
  );
  const compose = join(root, 'compose.yaml');
  try {
    await writeFile(
      compose,
      `services:\n  app:\n    environment:\n      MODEL_URL: http://127.0.0.1:\${PORT:-11}\${TAIL:-434}\n`
    );
    assert.match(
      (await scanCompose(root)).stdout,
      new RegExp(
        `^compose-interpolation:${compose.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\|`,
        'm'
      )
    );
    await writeFile(
      compose,
      `services:\n  app:\n    environment:\n      VALUE: \${PORT:-\${NESTED}}\n`
    );
    await assert.rejects(scanCompose(root), (error) => error.code === 2);
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
