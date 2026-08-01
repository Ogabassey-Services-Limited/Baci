import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);

async function capture(scanner, nginxRoot, composeRoot, systemdRoot) {
  const { stdout } = await execFileAsync('sh', [
    '-c',
    'systemctl() { :; }; stat() { printf "1:2:81a4:10:501:20:644\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; . "$1"; NGINX_ROOT="$2"; COMPOSE_ROOTS="$3"; SYSTEMD_ROOTS="$4"; init_temp_root; trap cleanup_temp EXIT; "$5"',
    'retire-ollama-consumer-content-binding-test',
    script.pathname,
    nginxRoot,
    composeRoot,
    systemdRoot,
    scanner,
  ]);
  return stdout;
}

test('binds matching consumer surfaces to same-path content changes', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-consumer-binding-'))
  );
  const nginxRoot = join(directory, 'nginx');
  const composeRoot = join(directory, 'compose');
  const systemdRoot = join(directory, 'systemd');
  try {
    await Promise.all(
      [nginxRoot, composeRoot, systemdRoot].map((path) =>
        mkdir(path, { recursive: true })
      )
    );
    const fixtures = [
      {
        scanner: 'scan_nginx_definitions',
        path: join(nginxRoot, 'proxy.conf'),
        before: 'set $ollama_upstream http://127.0.0.1:11434;\n',
        after: 'set $ollama_upstream http://127.0.0.1:11435;\n',
      },
      {
        scanner: 'scan_compose_definitions',
        path: join(composeRoot, 'compose.yaml'),
        before: 'environment:\n  OLLAMA_HOST: http://127.0.0.1:11434\n',
        after: 'environment:\n  OLLAMA_HOST: http://127.0.0.1:11435\n',
      },
      {
        scanner: 'scan_systemd_consumers',
        path: join(systemdRoot, 'consumer.service'),
        before: '[Service]\nEnvironment=OLLAMA_HOST=http://127.0.0.1:11434\n',
        after: '[Service]\nEnvironment=OLLAMA_HOST=http://127.0.0.1:11435\n',
      },
    ];

    for (const fixture of fixtures) {
      await writeFile(fixture.path, fixture.before);
      const before = await capture(
        fixture.scanner,
        nginxRoot,
        composeRoot,
        systemdRoot
      );
      await writeFile(fixture.path, fixture.after);
      const after = await capture(
        fixture.scanner,
        nginxRoot,
        composeRoot,
        systemdRoot
      );
      assert.notEqual(before, '');
      assert.notEqual(after, before, `${fixture.scanner} retained stale bytes`);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
