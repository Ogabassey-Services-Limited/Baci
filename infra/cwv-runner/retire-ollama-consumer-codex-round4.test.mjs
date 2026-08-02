import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmod,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
  unlink,
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
const unprivileged = process.getuid?.() === 0 ? { gid: 65534, uid: 65534 } : {};

function assertBoundPair(output, definition, target) {
  const fields = output.trim().split('|');
  assert.equal(fields[0], definition);
  assert.match(fields[1], /^[0-9a-f]{64}$/);
  assert.match(fields[2], /^[0-9a-f]{64}$/);
  assert.equal(fields[3], target);
  assert.match(fields[4], /^[0-9a-f]{64}$/);
  assert.match(fields[5], /^[0-9a-f]{64}$/);
}

test('binds a Compose long env_file mapping while rejecting an unsafe path', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-compose-long-mapping-'))
  );
  const compose = join(directory, 'compose.yaml');
  const environment = join(directory, 'application.env');
  try {
    await writeFile(
      compose,
      'services:\n  app:\n    env_file: [{path: ./application.env, required: false, format: raw}]\n'
    );
    await writeFile(environment, 'OLLAMA_HOST=http://127.0.0.1:11434\n');
    await Promise.all([
      chmod(directory, 0o755),
      chmod(compose, 0o644),
      chmod(environment, 0o644),
    ]);
    const run = () =>
      execFileAsync(
        'sh',
        [
          '-c',
          `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); COMPOSE_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_compose_definitions`,
          'retire-ollama-compose-long-mapping-test',
          script.pathname,
          directory,
        ],
        unprivileged
      );
    assertBoundPair((await run()).stdout, compose, environment);
    await rm(environment);
    assert.equal((await run()).stdout, '');
    await writeFile(environment, 'OLLAMA_HOST=http://127.0.0.1:11434\n');
    await writeFile(
      compose,
      'services:\n  app:\n    env_file: [{path: ../application.env}]\n'
    );
    await assert.rejects(run(), (error) => error.code === 2);
    await writeFile(
      compose,
      'services:\n  app:\n    env_file: [{path: ./application.env, ignored: true}]\n'
    );
    await assert.rejects(run(), (error) => error.code === 2);
    await symlink(environment, join(directory, 'application-link.env'));
    await writeFile(
      compose,
      'services:\n  app:\n    env_file: [{path: ./application-link.env}]\n'
    );
    await assert.rejects(run(), (error) => error.code === 2);
    const outside = join(directory, 'outside');
    await mkdir(outside);
    await writeFile(
      join(outside, 'application.env'),
      'OLLAMA_HOST=http://127.0.0.1:11434\n'
    );
    await symlink(outside, join(directory, 'linked-parent'));
    await writeFile(
      compose,
      'services:\n  app:\n    env_file: [{path: ./linked-parent/application.env}]\n'
    );
    await assert.rejects(run(), (error) => error.code === 2);
    await rm(join(outside, 'application.env'));
    await writeFile(
      compose,
      'services:\n  app:\n    env_file: [{path: ./linked-parent/application.env, required: false}]\n'
    );
    await assert.rejects(run(), (error) => error.code === 2);
    const absoluteLink = join(directory, 'absolute-link');
    await symlink(outside, absoluteLink);
    await writeFile(
      compose,
      `services:\n  app:\n    env_file: [{path: ${absoluteLink}/missing.env, required: false}]\n`
    );
    await assert.rejects(run(), (error) => error.code === 2);
    const absoluteEnvironment = join(outside, 'absolute.env');
    await writeFile(
      absoluteEnvironment,
      'OLLAMA_HOST=http://127.0.0.1:11434\n'
    );
    await writeFile(
      compose,
      `services:\n  app:\n    env_file: [{path: ${absoluteEnvironment}}]\n`
    );
    assertBoundPair((await run()).stdout, compose, absoluteEnvironment);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('fingerprints a linked systemd unit definition without accepting a linked fragment', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-linked-unit-'))
  );
  const roots = join(directory, 'roots');
  const definition = join(directory, 'application.service');
  const alias = join(directory, 'application-link.service');
  try {
    await mkdir(roots);
    await writeFile(
      definition,
      '[Service]\nEnvironment=OLLAMA_HOST=http://127.0.0.1:11434\n'
    );
    await symlink(definition, join(roots, 'application.service'));
    const run = () =>
      execFileAsync('sh', [
        '-c',
        `${prelude}getent() { return 2; }; systemctl() { case "$1" in list-unit-files) printf 'application.service linked\\n';; esac; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); SYSTEMD_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_systemd_consumers`,
        'retire-ollama-linked-unit-test',
        script.pathname,
        roots,
      ]);
    const fields = (await run()).stdout.trim().split('|');
    assert.equal(fields[0], definition);
    assert.match(fields[1], /^[0-9a-f]{64}$/);
    assert.match(fields[2], /^[0-9a-f]{64}$/);
    await symlink(definition, alias);
    await unlink(join(roots, 'application.service'));
    await symlink(alias, join(roots, 'application.service'));
    await assert.rejects(run(), (error) => error.code === 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('scans a stopped user unit when the owner user manager is unavailable', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-user-stopped-'))
  );
  const systemRoots = join(directory, 'system');
  const userHome = join(directory, 'home');
  const userRoots = join(userHome, '.config', 'systemd', 'user');
  const definition = join(userRoots, 'stopped.service');
  const marker = join(directory, 'unexpected-user-manager-call');
  try {
    await Promise.all([
      mkdir(systemRoots),
      mkdir(userRoots, { recursive: true }),
    ]);
    const target = join(directory, 'stopped-target.service');
    await writeFile(
      target,
      '[Service]\nEnvironment=OLLAMA_HOST=http://127.0.0.1:11434\n'
    );
    await symlink(target, definition);
    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}home=$3; marker=$4; availability=$marker.availability; getent() { printf 'bassey:x:1001:1001::%s:/bin/sh\\n' "$home"; }; systemctl() { case "$1" in --user) : >"$marker"; return 1;; list-unit-files|list-units) return 0;; esac; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); SYSTEMD_ROOTS="$2"; load_consumer_scanners; systemd_user_manager_available() { : >"$availability"; return 1; }; init_temp_root; trap cleanup_temp EXIT; scan_systemd_consumers; test -e "$availability" && test ! -e "$marker" && printf stable`,
      'retire-ollama-user-stopped-test',
      script.pathname,
      systemRoots,
      userHome,
      marker,
    ]);
    assert.match(
      stdout,
      new RegExp(`^${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\|`, 'm')
    );
    assert.match(stdout, /stable$/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('queries a live owner user manager through the fixed host-user bus', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-user-runtime-'))
  );
  const systemRoots = join(directory, 'system');
  const userHome = join(directory, 'home');
  try {
    await Promise.all([mkdir(systemRoots), mkdir(userHome)]);
    const property = 'Environment=OLLAMA_HOST=http://127.0.0.1:11434';
    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}home=$3; getent() { printf 'bassey:x:1001:1001::%s:/bin/sh\\n' "$home"; }; systemctl() { if [ "$1" = --user ]; then [ "$2" = --machine=bassey@.host ] || return 64; shift 2; case "$1" in list-unit-files) return 0;; list-units) printf 'user-transient.service loaded active running transient\\n';; show) printf 'Environment=OLLAMA_HOST=http://127.0.0.1:11434\\nEnvironmentFiles=\\nExecStart={}\\n';; *) return 64;; esac; else case "$1" in list-unit-files|list-units) return 0;; *) return 64;; esac; fi; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); SYSTEMD_ROOTS="$2"; load_consumer_scanners; systemd_user_manager_available() { return 0; }; init_temp_root; trap cleanup_temp EXIT; scan_systemd_consumers`,
      'retire-ollama-user-runtime-test',
      script.pathname,
      systemRoots,
      userHome,
    ]);
    assert.equal(
      stdout.trim(),
      `user-transient.service:${createHash('sha256').update(property).digest('hex')}`
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
