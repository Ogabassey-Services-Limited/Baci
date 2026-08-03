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

test('binds a stopped container configuration embedded in an option', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-container-option-path-'))
  );
  try {
    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}docker() { case "$*" in *' ps -a '*) printf 'generic-api\\n' ;; *'inspect -f {{.Name}} generic-api') printf '/generic-api\\n' ;; *'inspect -f {{json .State.Running}} generic-api') printf 'false\\n' ;; *'inspect -f {{json .Args}} generic-api') printf '["--","/opt/application-worker","-c=/etc/application.conf"]\\n' ;; *'inspect -f {{json .Mounts}} generic-api') printf '[]\\n' ;; *'inspect -f {{.Id}} '*) printf 'generic-api /generic-api /usr/bin/tini ["--","/opt/application-worker","-c=/etc/application.conf"] [] {} null [] {} {} {} [] "bridge"\\n' ;; *' cp generic-api:/usr/bin/tini '*) for destination do :; done; printf '#!/bin/sh\\nexit 0\\n' >"$destination" ;; *' cp generic-api:/opt/application-worker '*) for destination do :; done; printf '#!/bin/sh\\nexit 0\\n' >"$destination" ;; *' cp generic-api:/etc/application.conf '*) for destination do :; done; printf 'endpoint=http://127.0.0.1:11434\\n' >"$destination" ;; *) return 2 ;; esac; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); RETIRE_OLLAMA_TMPDIR="$2"; init_temp_root; trap cleanup_temp EXIT; CANONICAL_DOCKER_SOCKET=/run/docker.sock; CONTAINER=ollama-loopback; scan_container_rows all`,
      'retire-ollama-container-option-path-test',
      script.pathname,
      directory,
    ]);
    assert.match(
      stdout,
      /container-argument:generic-api:\/etc\/application\.conf/
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('binds a Compose-only image filesystem containing the endpoint', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-compose-image-filesystem-'))
  );
  const compose = join(directory, 'compose.yaml');
  const imageId = `sha256:${'a'.repeat(64)}`;
  try {
    await writeFile(
      compose,
      'services:\n  app:\n    image: generic-local-image\n'
    );
    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}docker() { case "$*" in *'image inspect -f '*' generic-local-image') printf '${imageId} []\\n' ;; *'image save '*'sha256:'*) printf 'filesystem endpoint=http://127.0.0.1:11434\\n' ;; *) return 2 ;; esac; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); COMPOSE_ROOTS="$2"; CANONICAL_DOCKER_SOCKET=/run/docker.sock; init_temp_root; trap cleanup_temp EXIT; scan_compose_definitions`,
      'retire-ollama-compose-image-filesystem-test',
      script.pathname,
      directory,
    ]);
    assert.match(stdout, /^compose-image-filesystem:/m);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('fails closed on a variable-bearing Dockerfile RUN step', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-dockerfile-run-variable-'))
  );
  try {
    await Promise.all([
      writeFile(
        join(directory, 'compose.yaml'),
        'services:\n  app:\n    build: .\n'
      ),
      writeFile(
        join(directory, 'Dockerfile'),
        'FROM scratch\nARG PORT_A=11\nARG PORT_B=434\nRUN printf "http://127.0.0.1:$' +
          '{PORT_A}$' +
          '{PORT_B}\\n" > /application.conf\n'
      ),
    ]);
    await assert.rejects(
      execFileAsync('sh', [
        '-c',
        `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); COMPOSE_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_compose_definitions`,
        'retire-ollama-dockerfile-run-variable-test',
        script.pathname,
        directory,
      ]),
      (error) => error.code === 2
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
