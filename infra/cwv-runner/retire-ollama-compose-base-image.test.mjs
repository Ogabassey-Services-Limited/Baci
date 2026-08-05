import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);
const imageId = `sha256:${'a'.repeat(64)}`;
const prelude =
  'sha256sum() { /usr/bin/shasum -a 256 "$@"; }; stat() { printf "1:2:81a4:10:501:20:644\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; ';

test('scans inherited filesystem bytes from a marker-free Dockerfile base image', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-compose-base-image-'))
  );
  const compose = join(directory, 'compose.yaml');
  const dockerfile = join(directory, 'Dockerfile');
  try {
    await Promise.all([
      writeFile(compose, 'services:\n  app:\n    build: .\n'),
      writeFile(dockerfile, 'FROM hidden-image\n'),
    ]);
    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}docker() { case "$*" in *'image inspect -f'*'hidden-image') printf '%s {"Cmd":["/usr/bin/worker"]}\\n' '${imageId}' ;; *'image save'*) printf 'endpoint=http://127.0.0.1:11434\\n' ;; *) return 2 ;; esac; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); init_temp_root; trap cleanup_temp EXIT; load_consumer_scanners; scan_compose_build_images "$2" "$3"`,
      'retire-ollama-compose-base-image-test',
      script.pathname,
      compose,
      dockerfile,
    ]);
    assert.match(stdout, /^compose-build-image-filesystem:/m);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
