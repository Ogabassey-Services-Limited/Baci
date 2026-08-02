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

test('normalizes a root-level relative lib target through usr/lib', async () => {
  const { stdout } = await execFileAsync('sh', [
    '-c',
    '. "$1"; SCRIPT_DIR=$(dirname "$1"); load_consumer_scanners; systemd_merged_usr_target /lib usr/lib systemd/user/keyboxd.socket',
    'retire-ollama-systemd-root-merged-usr-test',
    script.pathname,
  ]);
  assert.equal(stdout, '/usr/lib/systemd/user/keyboxd.socket\n');
});

test('scans an absolute systemd link through a merged-usr lib ancestor', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-merged-usr-link-'))
  );
  const aliasRoot = join(directory, 'lib', 'systemd', 'user');
  const canonicalRoot = join(directory, 'usr', 'lib', 'systemd', 'user');
  const wants = join(
    directory,
    'etc',
    'systemd',
    'user',
    'sockets.target.wants'
  );
  const definition = join(canonicalRoot, 'keyboxd.socket');
  try {
    await Promise.all([
      mkdir(canonicalRoot, { recursive: true }),
      mkdir(wants, { recursive: true }),
    ]);
    await symlink('usr/lib', join(directory, 'lib'));
    await writeFile(definition, '[Socket]\nListenStream=127.0.0.1:11434\n');
    await symlink(
      join(aliasRoot, 'keyboxd.socket'),
      join(wants, 'keyboxd.socket')
    );
    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); load_consumer_scanners; init_temp_root; trap cleanup_temp EXIT; roots=$(temp_path); environment=$(temp_path); printf '%s\\n%s\\n' "$2" "$3" >"$roots"; systemd_linked_definitions "$environment" "$roots" 0`,
      'retire-ollama-systemd-merged-usr-link-test',
      script.pathname,
      wants,
      canonicalRoot,
    ]);
    assert.match(
      stdout,
      new RegExp(
        `^${definition.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\|[0-9a-f]{64}\\|[0-9a-f]{64}\\n$`
      )
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('rejects an absolute systemd target through a non-merged lib link', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-unsafe-lib-link-'))
  );
  const outside = join(directory, 'outside', 'systemd', 'user');
  const target = join(directory, 'lib', 'systemd', 'user', 'keyboxd.socket');
  try {
    await mkdir(outside, { recursive: true });
    await symlink('outside', join(directory, 'lib'));
    await writeFile(`${outside}/keyboxd.socket`, '[Socket]\n');
    await assert.rejects(
      execFileAsync('sh', [
        '-c',
        `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); load_consumer_scanners; init_temp_root; trap cleanup_temp EXIT; roots=$(temp_path); printf '%s\\n' "$2" >"$roots"; systemd_absolute_link_definition "$3" "$roots"`,
        'retire-ollama-systemd-unsafe-lib-link-test',
        script.pathname,
        outside,
        target,
      ]),
      (error) => error.code === 2
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
