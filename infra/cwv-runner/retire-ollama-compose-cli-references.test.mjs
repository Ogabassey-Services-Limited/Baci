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
  'sha256sum() { /usr/bin/shasum -a 256 "$@"; }; stat() { printf "1:2:81a4:10:501:20:644\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; ';

test('discovers a custom Compose file selected by a stopped systemd service', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-compose-cli-reference-'))
  );
  const composeRoot = join(directory, 'projects');
  const systemdRoot = join(directory, 'units');
  const compose = join(composeRoot, 'production-stack.yml');
  const unit = join(systemdRoot, 'application.service');
  try {
    await Promise.all([mkdir(composeRoot), mkdir(systemdRoot)]);
    await Promise.all([
      writeFile(
        compose,
        'services:\n  app:\n    environment:\n      OLLAMA_HOST: http://127.0.0.1:11434\n'
      ),
      writeFile(
        unit,
        `[Service]\nExecStart=/usr/bin/docker compose -f ${compose} up\n`
      ),
    ]);

    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); COMPOSE_ROOTS="$2"; SYSTEMD_ROOTS="$3"; init_temp_root; trap cleanup_temp EXIT; scan_compose_definitions`,
      'retire-ollama-compose-cli-reference-test',
      script.pathname,
      composeRoot,
      systemdRoot,
    ]);

    assert.match(stdout, new RegExp(`^${compose}\\|`, 'm'));
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
