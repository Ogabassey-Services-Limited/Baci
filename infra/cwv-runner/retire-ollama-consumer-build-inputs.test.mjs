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
  'sha256sum() { /usr/bin/shasum -a 256 "$@"; }; stat() { printf "1:2:81a4:10:501:20:644\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; ';

function scanCompose(root) {
  return execFileAsync('sh', [
    '-c',
    `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); COMPOSE_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_compose_definitions`,
    'retire-ollama-compose-build-inputs-test',
    script.pathname,
    root,
  ]);
}

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

test('binds local Dockerfile COPY and ADD sources containing the endpoint', async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-compose-build-copy-'))
  );
  const compose = join(root, 'compose.yaml');
  const dockerfile = join(root, 'Dockerfile');
  const copySource = join(root, 'application-worker');
  const addSource = join(root, 'runtime-settings');
  try {
    await Promise.all([
      writeFile(compose, 'services:\n  app:\n    build: .\n'),
      writeFile(
        dockerfile,
        'FROM scratch\nCOPY application-worker /opt/app/\nADD runtime-settings /opt/app/\n'
      ),
      writeFile(copySource, '#!/bin/sh\ncurl http://127.0.0.1:11434\n'),
      writeFile(addSource, 'OLLAMA_HOST=http://127.0.0.1:11434\n'),
    ]);
    const { stdout } = await scanCompose(root);
    assertBinding(stdout, compose, copySource);
    assertBinding(stdout, compose, addSource);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('refuses a Dockerfile COPY source that escapes its build context', async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-compose-build-copy-escape-'))
  );
  const compose = join(root, 'compose.yaml');
  const dockerfile = join(root, 'Dockerfile');
  try {
    await Promise.all([
      writeFile(compose, 'services:\n  app:\n    build: .\n'),
      writeFile(
        dockerfile,
        'FROM scratch\nCOPY ../application-worker /opt/app/\n'
      ),
    ]);
    await assert.rejects(scanCompose(root), (error) => error.code === 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('binds a Dockerfile RUN bind mount sourced from the build context', async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-compose-build-run-bind-'))
  );
  const compose = join(root, 'compose.yaml');
  const dockerfile = join(root, 'Dockerfile');
  const source = join(root, 'application.conf');
  try {
    await Promise.all([
      writeFile(compose, 'services:\n  app:\n    build: .\n'),
      writeFile(
        dockerfile,
        'FROM scratch\nRUN --mount=type=bind,source=application.conf,target=/tmp/application.conf cat /tmp/application.conf\n'
      ),
      writeFile(source, 'OLLAMA_HOST=http://127.0.0.1:11434\n'),
    ]);
    assertBinding((await scanCompose(root)).stdout, compose, source);
    await writeFile(
      dockerfile,
      'FROM scratch\nRUN --network=none --mount=type=bind,source=application.conf,target=/tmp/application.conf cat /tmp/application.conf\n'
    );
    assertBinding((await scanCompose(root)).stdout, compose, source);
    await writeFile(
      dockerfile,
      'FROM scratch\nRUN --mount=type=bind,source=../application.conf,target=/tmp/application.conf cat /tmp/application.conf\n'
    );
    await assert.rejects(scanCompose(root), (error) => error.code === 2);
    await writeFile(
      dockerfile,
      `FROM scratch\nRUN --network=\${BUILD_NETWORK} --mount=type=bind,source=application.conf,target=/tmp/application.conf cat /tmp/application.conf\n`
    );
    await assert.rejects(scanCompose(root), (error) => error.code === 2);
    await writeFile(
      dockerfile,
      'FROM scratch\nRUN --device=vendor.com/device --mount=type=bind,source=application.conf,target=/tmp/application.conf cat /tmp/application.conf\n'
    );
    await assert.rejects(scanCompose(root), (error) => error.code === 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
