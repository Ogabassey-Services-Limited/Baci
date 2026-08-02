import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  chmod,
  mkdir,
  mkdtemp,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);
const unprivileged = process.getuid?.() === 0 ? { gid: 65534, uid: 65534 } : {};
const prelude =
  'sha256sum() { /usr/bin/shasum -a 256 "$@"; }; stat() { printf "1:2:81a4:10:501:20:644\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; ';

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

function scanCompose(root) {
  return execFileAsync('sh', [
    '-c',
    `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); COMPOSE_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_compose_definitions`,
    'retire-ollama-compose-closure-test',
    script.pathname,
    root,
  ]);
}

test('binds a valid flow-form Compose build mapping to its custom Dockerfile', async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-compose-flow-build-'))
  );
  const compose = join(root, 'compose.yaml');
  const dockerfile = join(root, 'Dockerfile.ollama');
  try {
    await Promise.all([
      writeFile(
        compose,
        'services:\n  app:\n    build: { context: ., dockerfile: Dockerfile.ollama }\n'
      ),
      writeFile(dockerfile, 'RUN curl http://ollama:11434\n'),
    ]);
    assertBinding((await scanCompose(root)).stdout, compose, dockerfile);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('accepts source-less Docker tmpfs mounts but rejects a tmpfs carrying host source', async () => {
  const root = await mkdtemp(join(tmpdir(), 'baci-container-tmpfs-'));
  const bin = join(root, 'bin');
  const mounts = join(root, 'mounts.json');
  try {
    await mkdir(bin);
    await Promise.all([
      writeFile(
        mounts,
        '[{"Type":"tmpfs","Source":"","Destination":"/run/cache","Mode":"","RW":true,"Propagation":"","Name":null}]\n'
      ),
      writeFile(
        join(bin, 'docker'),
        `#!/bin/sh
case "$*" in
  *' ps -a '*) printf 'generic-api\\n' ;;
  *'inspect -f {{.Name}} generic-api') printf '/generic-api\\n' ;;
  *'inspect -f {{.Id}} '* ) printf 'generic-api /generic-api /bin/true [] [] [] '; cat '${mounts}'; printf ' {} {} {}\\n' ;;
  *'inspect -f {{json .Mounts}} generic-api') cat '${mounts}' ;;
esac
`
      ),
    ]);
    await chmod(join(bin, 'docker'), 0o755);
    const scan = () =>
      execFileAsync(
        'sh',
        [
          '-c',
          `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); init_temp_root; trap cleanup_temp EXIT; CANONICAL_DOCKER_SOCKET=/tmp/docker.sock; scan_container_rows all`,
          'retire-ollama-container-tmpfs-test',
          script.pathname,
        ],
        {
          ...unprivileged,
          env: { ...process.env, RETIRE_OLLAMA_TEST_BIN: bin },
        }
      );
    assert.equal((await scan()).stdout, '');
    await writeFile(
      mounts,
      '[{"Type":"tmpfs","Source":"/host","Destination":"/run/cache","Mode":"","RW":true,"Propagation":"","Name":null}]\n'
    );
    await assert.rejects(scan(), (error) => error.code === 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('binds stopped Compose config and secret file sources inside their project root', async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-compose-external-files-'))
  );
  const compose = join(root, 'compose.yaml');
  const config = join(root, 'config', 'runner.conf');
  const secret = join(root, 'secrets', 'runner.token');
  try {
    await Promise.all([
      mkdir(join(root, 'config')),
      mkdir(join(root, 'secrets')),
    ]);
    await Promise.all([
      writeFile(
        compose,
        'services:\n  stopped:\n    image: busybox\nconfigs:\n  runner:\n    file: ./config/runner.conf\nsecrets:\n  token:\n    file: ./secrets/runner.token\n'
      ),
      writeFile(config, 'OLLAMA_HOST=http://127.0.0.1:11434\n'),
      writeFile(secret, 'OLLAMA_TOKEN=example\n'),
    ]);
    const { stdout } = await scanCompose(root);
    assertBinding(stdout, compose, config);
    assertBinding(stdout, compose, secret);
    await writeFile(
      compose,
      'configs:\n  runner:\n    file: ../outside.conf\n'
    );
    await assert.rejects(scanCompose(root), (error) => error.code === 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
