import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);

test('detects uppercase Ollama hosts in Compose definitions', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-ollama-compose-'));
  const compose = join(directory, 'compose.yaml');
  try {
    await writeFile(
      compose,
      'services:\n  app:\n    environment:\n      OLLAMA_HOST: http://127.0.0.1:8080\n'
    );
    const { stdout } = await execFileAsync('sh', [
      '-c',
      'stat() { printf "1:2:81a4:10:501:20:644\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; readlink() { for path do :; done; printf "%s\\n" "$path"; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); init_temp_root; trap cleanup_temp EXIT; COMPOSE_ROOTS="$2"; scan_compose_definitions',
      'retire-ollama-compose-test',
      script.pathname,
      directory,
    ]);
    const [path, contentSha256, identitySha256] = stdout.trim().split('|');
    assert.equal(path, compose);
    assert.match(contentSha256, /^[0-9a-f]{64}$/);
    assert.match(identitySha256, /^[0-9a-f]{64}$/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
