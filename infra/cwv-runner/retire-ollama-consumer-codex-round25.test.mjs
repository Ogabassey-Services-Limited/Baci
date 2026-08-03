import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);
const prelude =
  'sha256sum() { /usr/bin/shasum -a 256 "$@"; }; stat() { printf "1:2:81a4:10:0:0:600\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; ';

test('binds a RootDirectory option path consumed by a stopped unit', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-rooted-option-'))
  );
  const units = join(directory, 'units');
  const executionRoot = join(directory, 'execution-root');
  const worker = join(executionRoot, 'usr/bin/application-worker');
  const config = join(executionRoot, 'etc/application.conf');
  try {
    await Promise.all([
      mkdir(units),
      mkdir(dirname(worker), { recursive: true }),
      mkdir(dirname(config), { recursive: true }),
    ]);
    await Promise.all([
      writeFile(worker, '#!/bin/sh\nexit 0\n', { mode: 0o755 }),
      writeFile(config, 'endpoint=http://127.0.0.1:11434\n'),
      writeFile(
        join(units, 'application.service'),
        `[Service]\nRootDirectory=${executionRoot}\nExecStart=/usr/bin/application-worker -c=/etc/application.conf\n`
      ),
    ]);

    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}getent() { return 2; }; systemctl() { return 0; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); SYSTEMD_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_systemd_consumers`,
      'retire-ollama-systemd-rooted-option-test',
      script.pathname,
      units,
    ]);

    assert.match(stdout, new RegExp(`\\|${config}\\|`));
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('binds a runtime Exec argv option path', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-runtime-argv-'))
  );
  const worker = join(directory, 'application-worker');
  const config = join(directory, 'application.conf');
  try {
    await Promise.all([
      writeFile(worker, '#!/bin/sh\nexit 0\n', { mode: 0o755 }),
      writeFile(config, 'endpoint=http://127.0.0.1:11434\n'),
    ]);
    const property = `ExecStart={ path=${worker} ; argv[]=${worker} -c=${config} ; ignore_errors=no ; start_time=[n/a] ; stop_time=[n/a] ; pid=0 ; code=(null) ; status=0/0 }`;

    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); load_consumer_scanners; init_temp_root; trap cleanup_temp EXIT; systemd_runtime_wrapper_script application.service "$2" /`,
      'retire-ollama-systemd-runtime-argv-test',
      script.pathname,
      property,
    ]);

    assert.match(
      stdout,
      new RegExp(`^application\\.service:${config}\\|`, 'm')
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('skips an absent runtime argv candidate before scanning the next candidate', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-runtime-argv-missing-'))
  );
  const worker = join(directory, 'application-worker');
  const config = join(directory, 'application.conf');
  const missing = join(directory, 'missing-worker');
  try {
    await Promise.all([
      writeFile(worker, '#!/bin/sh\nexit 0\n', { mode: 0o755 }),
      writeFile(config, 'endpoint=http://127.0.0.1:11434\n'),
    ]);
    const property = `ExecStart={ path=${missing} ; argv[]=${missing} ; } { path=${worker} ; argv[]=${worker} -c=${config} ; }`;

    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); load_consumer_scanners; init_temp_root; trap cleanup_temp EXIT; systemd_runtime_wrapper_script application.service "$2" /`,
      'retire-ollama-systemd-runtime-argv-missing-test',
      script.pathname,
      property,
    ]);

    assert.match(
      stdout,
      new RegExp(`^application\\.service:${config}\\|`, 'm')
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('binds a file-valued Environment assignment in a stopped unit', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-environment-path-'))
  );
  const units = join(directory, 'units');
  const config = join(directory, 'application.conf');
  const unit = join(units, 'application.service');
  try {
    await mkdir(units);
    await Promise.all([
      writeFile(config, 'endpoint=http://127.0.0.1:11434\n'),
      writeFile(
        unit,
        `[Service]\nEnvironment=CONFIG=${config}\nExecStart=/bin/true\n`
      ),
    ]);

    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}getent() { return 2; }; systemctl() { return 0; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); SYSTEMD_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_systemd_consumers`,
      'retire-ollama-systemd-environment-path-test',
      script.pathname,
      units,
    ]);

    assert.match(stdout, new RegExp(`^${unit}\\|.*\\|${config}\\|`, 'm'));
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('binds a stopped container file-valued environment assignment', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-container-environment-path-'))
  );
  try {
    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}docker() { case "$*" in *' ps -a '*) printf 'generic-api\\n' ;; *'inspect -f {{.Name}} generic-api') printf '/generic-api\\n' ;; *'inspect -f {{json .State.Running}} generic-api') printf 'false\\n' ;; *'inspect -f {{json .Config.Env}} generic-api') printf '["PATH=/usr/bin:/bin","HOME=/root","CONFIG=/etc/application.conf"]\\n' ;; *'inspect -f {{json .Config.WorkingDir}} generic-api') printf '""\\n' ;; *'inspect -f {{json .Args}} generic-api') printf '[]\\n' ;; *'inspect -f {{json .Mounts}} generic-api') printf '[]\\n' ;; *'inspect -f {{.Id}} '*) printf 'generic-api /generic-api /usr/bin/application-worker [] ["PATH=/usr/bin:/bin","HOME=/root","CONFIG=/etc/application.conf"] "" {} null [] {} {} {} [] "bridge"\\n' ;; *' cp generic-api:/usr/bin/application-worker '*) for destination do :; done; printf '#!/bin/sh\\nexit 0\\n' >"$destination" ;; *' cp generic-api:/root '*) for destination do :; done; mkdir "$destination" ;; *' cp generic-api:/etc/application.conf '*) for destination do :; done; printf 'endpoint=http://127.0.0.1:11434\\n' >"$destination" ;; *) return 2 ;; esac; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); RETIRE_OLLAMA_TMPDIR="$2"; init_temp_root; trap cleanup_temp EXIT; CANONICAL_DOCKER_SOCKET=/run/docker.sock; CONTAINER=ollama-loopback; scan_container_rows all`,
      'retire-ollama-container-environment-path-test',
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
