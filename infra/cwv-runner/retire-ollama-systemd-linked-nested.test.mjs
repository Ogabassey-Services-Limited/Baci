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

test('scans and deduplicates stopped system and owner-user nested wants links', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-linked-nested-'))
  );
  const systemRoot = join(directory, 'system');
  const userHome = join(directory, 'home');
  const userRoot = join(userHome, '.config', 'systemd', 'user');
  const systemTarget = join(directory, 'foreign-system.service');
  const userTarget = join(directory, 'foreign-user.service');
  try {
    await Promise.all([
      mkdir(join(systemRoot, 'multi-user.target.wants'), { recursive: true }),
      mkdir(join(userRoot, 'default.target.wants'), { recursive: true }),
      writeFile(
        systemTarget,
        '[Service]\nEnvironment=OLLAMA_HOST=http://127.0.0.1:11434\n'
      ),
      writeFile(
        userTarget,
        '[Service]\nEnvironment=OLLAMA_HOST=http://127.0.0.1:11434\n'
      ),
    ]);
    await Promise.all([
      symlink(
        systemTarget,
        join(systemRoot, 'multi-user.target.wants', 'ollama.service')
      ),
      symlink(
        systemTarget,
        join(systemRoot, 'multi-user.target.wants', 'duplicate.service')
      ),
      symlink(
        userTarget,
        join(userRoot, 'default.target.wants', 'ollama.service')
      ),
    ]);
    const { stdout } = await execFileAsync('sh', [
      '-c',
      'home=$3; getent() { printf "bassey:x:1001:1001::%s:/bin/sh\\n" "$home"; }; systemctl() { return 0; }; stat() { printf "1:2:81a4:10:501:20:644\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); SYSTEMD_ROOTS="$2"; load_consumer_scanners; systemd_user_manager_available() { return 1; }; init_temp_root; trap cleanup_temp EXIT; scan_systemd_consumers',
      'retire-ollama-systemd-linked-nested-test',
      script.pathname,
      systemRoot,
      userHome,
    ]);
    const records = stdout.trim().split('\n');
    assert.equal(records.length, 2);
    for (const target of [systemTarget, userTarget]) {
      const record = records.find((line) => line.startsWith(`${target}|`));
      assert.ok(record, `missing record for ${target}`);
      assert.match(
        record,
        new RegExp(`^${target}\\|[0-9a-f]{64}\\|[0-9a-f]{64}$`)
      );
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
