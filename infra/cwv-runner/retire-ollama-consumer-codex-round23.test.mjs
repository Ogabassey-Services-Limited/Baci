import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);
const prelude =
  'sha256sum() { /usr/bin/shasum -a 256 "$@"; }; stat() { printf "1:2:81a4:10:0:0:600\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; ';

test('fails closed on a cron-launched interpolated Compose environment', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-cron-compose-environment-'))
  );
  const units = join(directory, 'units');
  const project = join(directory, 'application');
  const compose = join(project, 'production-stack.yml');
  const cron = join(directory, 'crontab');
  const manifest = join(directory, 'cron-manifest.tsv');
  try {
    await Promise.all([mkdir(units), mkdir(project)]);
    await Promise.all([
      writeFile(
        compose,
        `services:\n  app:\n    environment:\n      MODEL_URL: http://127.0.0.1:\${PORT}\${TAIL}\n`
      ),
      writeFile(join(project, '.env'), 'PORT=80\nTAIL=80\n'),
      writeFile(
        cron,
        `PORT=11\nTAIL=434\n* * * * * root /usr/bin/docker compose -f ${compose} up -d\n`
      ),
      writeFile(manifest, `system\t-\t${cron}\n`),
    ]);

    await assert.rejects(
      execFileAsync('sh', [
        '-c',
        `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); load_consumer_scanners; init_temp_root; trap cleanup_temp EXIT; SYSTEMD_ROOTS="$2"; COMPOSE_ROOTS="$3"; CRON_SOURCE="$4"; RETIRE_OLLAMA_CRON_SOURCES="$5"; cron_inventory_anacrontab() { printf '/not-anacron\\n'; }; cron_inventory_system_file() { printf '%s\\n' "$CRON_SOURCE"; }; cron_inventory_system_dir() { printf '/etc/cron.d\\n'; }; cron_inventory_command_targets() { printf '/usr/bin/docker\\n'; }; scan_compose_definitions`,
        'retire-ollama-cron-compose-environment-test',
        script.pathname,
        units,
        project,
        cron,
        manifest,
      ]),
      (error) => error.code === 2
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('binds an absolute configuration embedded in a healthcheck option', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-healthcheck-option-path-'))
  );
  try {
    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}docker() { case "$*" in *'inspect -f {{json .Config.Healthcheck}} generic-api') printf '{"Test":["CMD","/opt/application-healthcheck","-c=/etc/application.conf"]}\\n' ;; *'inspect -f {{json .State.Running}} generic-api') printf 'false\\n' ;; *' cp generic-api:/opt/application-healthcheck '*) for destination do :; done; printf '#!/bin/sh\\nexit 0\\n' >"$destination" ;; *' cp generic-api:/etc/application.conf '*) for destination do :; done; printf 'endpoint=http://127.0.0.1:11434\\n' >"$destination" ;; *) return 2 ;; esac; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); load_consumer_scanners; RETIRE_OLLAMA_TMPDIR="$2"; init_temp_root; trap cleanup_temp EXIT; CANONICAL_DOCKER_SOCKET=/run/docker.sock; container_healthcheck_consumers generic-api 'generic-api /generic-api /bin/true [] [] {} {"Test":["CMD","/opt/application-healthcheck","-c=/etc/application.conf"]}'`,
      'retire-ollama-healthcheck-option-path-test',
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
