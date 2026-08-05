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
const prelude =
  'sha256sum() { /usr/bin/shasum -a 256 "$@"; }; stat() { printf "1:2:81a4:10:501:20:644\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; ';

test('fails closed when a Compose service inherits an image through a YAML merge', async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-compose-yaml-merge-'))
  );
  const bin = join(root, 'bin');
  const compose = join(root, 'compose.yaml');
  const imageId = `sha256:${'c'.repeat(64)}`;
  try {
    await mkdir(bin);
    await Promise.all([
      writeFile(
        compose,
        'x-application: &application\n  image: generic-base\nservices:\n  app:\n    <<: *application\n'
      ),
      writeFile(
        join(bin, 'docker'),
        `#!/bin/sh
case "$*" in
  *'image inspect -f '*' generic-base') printf '%s\\n' '${imageId} ["OLLAMA_HOST=http://127.0.0.1:11434"] {} null [] []' ;;
  *) exit 64 ;;
esac
`
      ),
    ]);
    await Promise.all([
      chmod(join(bin, 'docker'), 0o755),
      chmod(bin, 0o755),
      chmod(root, 0o755),
    ]);

    await assert.rejects(
      execFileAsync(
        'sh',
        [
          '-c',
          `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); COMPOSE_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_compose_definitions`,
          'retire-ollama-compose-yaml-merge-test',
          script.pathname,
          root,
        ],
        { env: { ...process.env, RETIRE_OLLAMA_TEST_BIN: bin } }
      ),
      (error) => error.code === 2
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
