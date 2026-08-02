import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);
const prelude =
  'stat() { printf "1:2:81a4:10:501:20:644\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; ';

function assertBinding(output, definition, target) {
  assert.ok(
    output
      .trim()
      .split('\n')
      .some(
        (line) =>
          line.startsWith(`${definition}|`) && line.includes(`|${target}|`)
      ),
    `missing binding from ${definition} to ${target}`
  );
}

test('accepts a nested relative systemd wants alias only when it resolves inside the scanned root', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-nested-relative-'))
  );
  const root = join(directory, 'units');
  const wants = join(root, 'graphical-session-pre.target.wants');
  const target = join(root, 'ssh-agent.service');
  const outside = join(directory, 'outside.service');
  try {
    await mkdir(wants, { recursive: true });
    await Promise.all([
      writeFile(
        target,
        '[Service]\nEnvironment=OLLAMA_HOST=http://127.0.0.1:11434\n'
      ),
      writeFile(
        outside,
        '[Service]\nEnvironment=OLLAMA_HOST=http://127.0.0.1:11434\n'
      ),
      symlink('../ssh-agent.service', join(wants, 'ssh-agent.service')),
      symlink('../../outside.service', join(wants, 'escape.service')),
    ]);
    const run = () =>
      execFileAsync('sh', [
        '-c',
        `${prelude}getent() { return 2; }; systemctl() { return 0; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); SYSTEMD_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_systemd_consumers`,
        'retire-ollama-systemd-nested-relative-test',
        script.pathname,
        root,
      ]);
    await assert.rejects(run(), (error) => error.code === 2);
    await rm(join(wants, 'escape.service'));
    const output = (await run()).stdout;
    assert.match(output, new RegExp(`^${target}\\|`, 'm'));
    assert.equal(output.trim().split('\n').length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('binds flow-list Compose env_file scalars and rejects mixed flow values', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-compose-flow-env-file-'))
  );
  const compose = join(directory, 'compose.yaml');
  const first = join(directory, 'one.env');
  const second = join(directory, 'two.env');
  try {
    await Promise.all([
      writeFile(
        compose,
        'services:\n  app:\n    env_file: [./one.env, "./two.env"]\n'
      ),
      writeFile(first, 'OLLAMA_HOST=http://127.0.0.1:11434\n'),
      writeFile(second, 'OLLAMA_HOST=http://127.0.0.1:11434\n'),
    ]);
    const run = () =>
      execFileAsync('sh', [
        '-c',
        `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); COMPOSE_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_compose_definitions`,
        'retire-ollama-compose-flow-env-file-test',
        script.pathname,
        directory,
      ]);
    const { stdout } = await run();
    assertBinding(stdout, compose, first);
    assertBinding(stdout, compose, second);
    await writeFile(compose, 'services:\n  app:\n    env_file: [./one.env]\n');
    assertBinding((await run()).stdout, compose, first);
    await writeFile(
      compose,
      'services:\n  app:\n    env_file: [./one.env, {path: ./two.env}]\n'
    );
    await assert.rejects(run(), (error) => error.code === 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('resolves Nginx relative includes from its canonical prefix and rejects traversal', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-nginx-relative-include-'))
  );
  const root = join(directory, 'nginx');
  const definition = join(root, 'nginx.conf');
  const mime = join(root, 'mime.types');
  const outside = join(directory, 'outside.conf');
  try {
    await mkdir(root);
    await Promise.all([
      writeFile(definition, 'include mime.types;\n'),
      writeFile(mime, 'proxy_pass http://127.0.0.1:11434;\n'),
      writeFile(outside, 'proxy_pass http://127.0.0.1:11434;\n'),
    ]);
    const run = () =>
      execFileAsync('sh', [
        '-c',
        `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); NGINX_ROOT="$2"; init_temp_root; trap cleanup_temp EXIT; scan_nginx_definitions`,
        'retire-ollama-nginx-relative-include-test',
        script.pathname,
        root,
      ]);
    assertBinding((await run()).stdout, definition, mime);
    await writeFile(definition, 'include ../outside.conf;\n');
    await assert.rejects(run(), (error) => error.code === 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('binds Compose build Dockerfiles while rejecting an explicit escape', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-compose-build-dockerfile-'))
  );
  const compose = join(directory, 'compose.yaml');
  const app = join(directory, 'app');
  const defaultDockerfile = join(directory, 'Dockerfile');
  const explicitDockerfile = join(directory, 'app.Dockerfile');
  try {
    await mkdir(app);
    await Promise.all([
      writeFile(
        compose,
        'services:\n  default:\n    build: .\n  explicit:\n    build:\n      context: ./app\n      dockerfile: ../app.Dockerfile\n      target: production\n      args:\n        BUILD_MODE: production\n'
      ),
      writeFile(defaultDockerfile, 'RUN curl http://ollama:11434\n'),
      writeFile(explicitDockerfile, 'RUN curl http://ollama:11434\n'),
    ]);
    const run = () =>
      execFileAsync('sh', [
        '-c',
        `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); COMPOSE_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_compose_definitions`,
        'retire-ollama-compose-build-dockerfile-test',
        script.pathname,
        directory,
      ]);
    const { stdout } = await run();
    assertBinding(stdout, compose, defaultDockerfile);
    assertBinding(stdout, compose, explicitDockerfile);
    await writeFile(
      compose,
      'services:\n  app:\n    build:\n      context: ./app\n      dockerfile: ../../outside.Dockerfile\n'
    );
    await assert.rejects(run(), (error) => error.code === 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('binds parent Compose contexts inside the configured scan root and defaults omitted mapping context', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-compose-parent-context-'))
  );
  const root = join(directory, 'scan');
  const nested = join(root, 'apps', 'web', 'mcp-server');
  const nestedCompose = join(nested, 'docker-compose.yml');
  const local = join(root, 'local');
  const localCompose = join(local, 'compose.yaml');
  const dockerfile = join(root, 'Dockerfile');
  try {
    await Promise.all([
      mkdir(nested, { recursive: true }),
      mkdir(local, { recursive: true }),
    ]);
    await Promise.all([
      writeFile(
        nestedCompose,
        'services:\n  app:\n    build:\n      context: ../../..\n      dockerfile: Dockerfile\n'
      ),
      writeFile(
        localCompose,
        'services:\n  local:\n    build:\n      dockerfile: ../Dockerfile\n'
      ),
      writeFile(dockerfile, 'RUN curl http://ollama:11434\n'),
    ]);
    const run = (scanRoot = root) =>
      execFileAsync('sh', [
        '-c',
        `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); COMPOSE_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_compose_definitions`,
        'retire-ollama-compose-parent-context-test',
        script.pathname,
        scanRoot,
      ]);
    const { stdout } = await run();
    assertBinding(stdout, nestedCompose, dockerfile);
    assertBinding(stdout, localCompose, dockerfile);
    const alias = join(directory, 'scan-alias');
    await symlink(root, alias);
    await assert.rejects(run(alias), (error) => error.code === 2);
    await writeFile(
      nestedCompose,
      'services:\n  app:\n    build:\n      context: ../../../..\n      dockerfile: Dockerfile\n'
    );
    await assert.rejects(run(), (error) => error.code === 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
