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
  'stat() { printf "1:2:81a4:10:501:20:644\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; ';

function assertBoundPair(output, definition, target) {
  const record = output
    .trim()
    .split('\n')
    .find(
      (line) =>
        line.startsWith(`${definition}|`) && line.includes(`|${target}|`)
    );
  assert.ok(record, `missing binding for ${target}`);
  const fields = record.split('|');
  assert.equal(fields[0], definition);
  assert.match(fields[1], /^[0-9a-f]{64}$/);
  assert.match(fields[2], /^[0-9a-f]{64}$/);
  assert.equal(fields[3], target);
  assert.match(fields[4], /^[0-9a-f]{64}$/);
  assert.match(fields[5], /^[0-9a-f]{64}$/);
}

test('binds Compose env_file values with YAML comments outside scalar, list, and mapping values', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-compose-comments-'))
  );
  const compose = join(directory, 'compose.yaml');
  const scalar = join(directory, 'scalar#literal.env');
  const list = join(directory, 'list # literal.env');
  const mapping = join(directory, 'mapping # literal.env');
  try {
    await mkdir(directory, { recursive: true });
    await writeFile(
      compose,
      'services:\n  scalar:\n    env_file: ./scalar#literal.env # deployment environment\n  list:\n    env_file:\n      - "./list # literal.env" # deployment environment\n  mapping:\n    env_file:\n      - path: "./mapping # literal.env" # deployment environment\n        required: false\n'
    );
    await Promise.all(
      [scalar, list, mapping].map((path) =>
        writeFile(path, 'OLLAMA_HOST=http://127.0.0.1:11434\n')
      )
    );
    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); COMPOSE_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_compose_definitions`,
      'retire-ollama-compose-comments-test',
      script.pathname,
      directory,
    ]);
    assertBoundPair(stdout, compose, scalar);
    assertBoundPair(stdout, compose, list);
    assertBoundPair(stdout, compose, mapping);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
