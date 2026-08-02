import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);
const shellPrelude =
  'stat() { printf "1:2:81a4:10:501:20:644\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; ';

function assertPair(output, first, second) {
  const fields = output.trim().split('\n')[0].split('|');
  assert.equal(fields[0], first);
  assert.match(fields[1], /^[0-9a-f]{64}$/);
  assert.match(fields[2], /^[0-9a-f]{64}$/);
  assert.equal(fields[3], second);
  assert.match(fields[4], /^[0-9a-f]{64}$/);
  assert.match(fields[5], /^[0-9a-f]{64}$/);
}

test('reads and binds a loaded transient unit EnvironmentFile consumer', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-runtime-environment-file-'))
  );
  const environment = join(directory, 'runtime.env');
  try {
    await writeFile(environment, 'OLLAMA_HOST=http://127.0.0.1:11434\n');
    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${shellPrelude}environment=$2; systemctl() { case "$1" in list-units) printf 'transient.service loaded active running transient\\n';; show) printf 'Environment=\\nEnvironmentFiles=%s (ignore_errors=no)\\nExecStart={}\\n' "$environment";; esac; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); init_temp_root; trap cleanup_temp EXIT; scan_systemd_runtime_consumers`,
      'retire-ollama-runtime-environment-file-test',
      script.pathname,
      environment,
    ]);
    assertPair(stdout, `transient.service:${environment}`, environment);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('tolerates a loaded unit disappearing only after refreshed inventory proves absence', async () => {
  const { stdout } = await execFileAsync('sh', [
    '-c',
    `${shellPrelude}calls=0; systemctl() { case "$1" in list-units) calls=$((calls + 1)); if [ "$calls" -eq 1 ]; then printf 'vanishing.service loaded active running transient\\n'; fi; return 0;; show) return 5;; esac; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); init_temp_root; trap cleanup_temp EXIT; scan_systemd_runtime_consumers; printf 'stable\\n'`,
    'retire-ollama-runtime-disappear-test',
    script.pathname,
  ]);
  assert.equal(stdout, 'stable\n');
});

test('fails when a unit remains in refreshed inventory after its properties vanish', async () => {
  await assert.rejects(
    execFileAsync('sh', [
      '-c',
      `${shellPrelude}systemctl() { case "$1" in list-units) printf 'racing.service loaded active running transient\\n';; show) return 5;; esac; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); init_temp_root; trap cleanup_temp EXIT; scan_systemd_runtime_consumers`,
      'retire-ollama-runtime-retained-test',
      script.pathname,
    ]),
    (error) => error.code === 5
  );
});

test('resolves and binds a Compose env_file consumer', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-compose-environment-file-'))
  );
  const compose = join(directory, 'compose.yaml');
  const environment = join(directory, 'app-settings.env');
  try {
    await writeFile(
      compose,
      'services:\n  app:\n    env_file:\n      - ./app-settings.env\n'
    );
    await writeFile(environment, 'OLLAMA_HOST=http://127.0.0.1:11434\n');
    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${shellPrelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); COMPOSE_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_compose_definitions`,
      'retire-ollama-compose-environment-file-test',
      script.pathname,
      directory,
    ]);
    assertPair(stdout, compose, environment);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('resolves and binds an Nginx include outside its configuration root', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-nginx-external-include-'))
  );
  const nginx = join(directory, 'nginx');
  const shared = join(directory, 'shared');
  const definition = join(nginx, 'site.conf');
  const included = join(shared, 'upstream.conf');
  try {
    await Promise.all([mkdir(nginx), mkdir(shared)]);
    await writeFile(definition, `include ${included};\n`);
    await writeFile(included, 'proxy_pass http://127.0.0.1:11434;\n');
    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${shellPrelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); NGINX_ROOT="$2"; init_temp_root; trap cleanup_temp EXIT; scan_nginx_definitions`,
      'retire-ollama-nginx-external-include-test',
      script.pathname,
      nginx,
    ]);
    assertPair(stdout, definition, included);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
