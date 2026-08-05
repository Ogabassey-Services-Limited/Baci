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

function scanCompose(root, docker) {
  return execFileAsync('sh', [
    '-c',
    `${prelude}docker() { ${docker} }; . "$1"; SCRIPT_DIR=$(dirname "$1"); COMPOSE_ROOTS="$2"; CANONICAL_DOCKER_SOCKET=/run/docker.sock; init_temp_root; trap cleanup_temp EXIT; scan_compose_definitions`,
    'retire-ollama-compose-external-test',
    script.pathname,
    root,
  ]);
}

test('binds an external config used by a stopped Compose service', async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-compose-external-config-'))
  );
  const compose = join(root, 'compose.yaml');
  const data = Buffer.from('OLLAMA_HOST=http://127.0.0.1:11434\n').toString(
    'base64'
  );
  const id = 'eo7jnzguqgtpdah3cm5srfb97';
  const inspect = JSON.stringify({
    ID: id,
    Spec: { Data: data, Name: 'shared-runtime' },
    Version: { Index: 7 },
  });
  try {
    await writeFile(
      compose,
      'services:\n  stopped:\n    configs:\n      - source: runtime\n        target: /etc/runtime.conf\nconfigs:\n  runtime:\n    external: true\n    name: shared-runtime\n'
    );
    const { stdout } = await scanCompose(
      root,
      `case "$*" in *' config inspect -f {{json .}} shared-runtime') printf '%s\\n' '${inspect}' ;; *) return 64 ;; esac`
    );
    assert.match(stdout, new RegExp(`^compose-config:${compose}\\|`, 'm'));
    assert.match(stdout, new RegExp(`\\|shared-runtime\\|${id}\\|`));
    assert.doesNotMatch(stdout, /OLLAMA_HOST|${data}/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('fails closed when an external Compose config cannot be inspected', async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-compose-external-missing-'))
  );
  try {
    await writeFile(
      join(root, 'compose.yaml'),
      'services:\n  pending:\n    configs:\n      - runtime\nconfigs:\n  runtime:\n    external: true\n'
    );
    await assert.rejects(
      scanCompose(root, 'return 64'),
      (error) => error.code === 2
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('fails closed when an external Compose config changes between inspections', async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-compose-external-drift-'))
  );
  const counter = join(root, 'inspect-count');
  const data = Buffer.from('OLLAMA_HOST=http://127.0.0.1:11434\n').toString(
    'base64'
  );
  try {
    await Promise.all([
      writeFile(
        join(root, 'compose.yaml'),
        'configs:\n  runtime:\n    external: true\n'
      ),
      writeFile(counter, '0\n'),
    ]);
    await assert.rejects(
      scanCompose(
        root,
        `count=$(cat '${counter}'); count=$((count + 1)); printf '%s\\n' "$count" >'${counter}'; if [ "$count" -eq 1 ]; then id=eo7jnzguqgtpdah3cm5srfb97; else id=6697bflskwj1998km1gnnjr38; fi; printf '{"ID":"%s","Version":{"Index":%s},"Spec":{"Name":"runtime","Data":"${data}"}}\\n' "$id" "$count"`
      ),
      (error) => error.code === 2
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
