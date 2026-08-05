import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmod,
  mkdir,
  mkdtemp,
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
const unprivileged = process.getuid?.() === 0 ? { uid: 65534, gid: 65534 } : {};
const absentCronSources = {
  RETIRE_OLLAMA_ANACRONTAB: '/__baci_test_absent_anacrontab',
  RETIRE_OLLAMA_CRON_HOURLY_DIR: '/__baci_test_absent_cron_hourly',
  RETIRE_OLLAMA_CRON_DAILY_DIR: '/__baci_test_absent_cron_daily',
  RETIRE_OLLAMA_CRON_WEEKLY_DIR: '/__baci_test_absent_cron_weekly',
  RETIRE_OLLAMA_CRON_MONTHLY_DIR: '/__baci_test_absent_cron_monthly',
};

async function fixtureDirectory(prefix) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  await chmod(directory, 0o777);
  return directory;
}

function shell(command, args = [], env = {}) {
  return execFileAsync(
    'sh',
    [
      '-c',
      `. "$1"; SCRIPT_DIR=$(dirname "$1"); init_temp_root; trap cleanup_temp EXIT; ${command}`,
      'retire-ollama-cron-periodic-test',
      script.pathname,
      ...args,
    ],
    {
      ...unprivileged,
      env: {
        ...process.env,
        RETIRE_OLLAMA_TEST_BIN: '/usr/bin',
        ...absentCronSources,
        ...env,
      },
    }
  );
}

function fixtureFunctions() {
  return `sha256sum() { /usr/bin/shasum -a 256 "$@"; }
readlink() { for path do :; done; printf '%s\\n' "$path"; }
stat() { format=; for arg do case "$arg" in -c) next=1;; *) if [ "\${next:-0}" = 1 ]; then format=$arg; next=0; fi;; esac; done; for path do :; done; case "$path" in */crontabs) owner=0; gid=123; mode=1730;; */cron.d|*/cron.hourly|*/cron.daily|*/cron.weekly|*/cron.monthly) owner=0; gid=0; mode=755;; */crontabs/*) owner=0; gid=123; mode=600;; *) owner=0; gid=0; mode=755;; esac; case "$format" in *%g*) printf '%s:%s:%s\\n' "$owner" "$gid" "$mode";; *) printf '%s:%s\\n' "$owner" "$mode";; esac; }
getent() { [ "$1:$2" = group:crontab ] && { printf 'crontab:x:123:\\n'; return 0; }; return 2; }`;
}

async function createFixture() {
  const directory = await fixtureDirectory('baci-cron-periodic-');
  const etc = join(directory, 'etc');
  const cronD = join(etc, 'cron.d');
  const spool = join(directory, 'spool', 'crontabs');
  const periodic = ['hourly', 'daily', 'weekly', 'monthly'].map((name) =>
    join(etc, `cron.${name}`)
  );
  await Promise.all([
    mkdir(cronD, { recursive: true }),
    mkdir(spool, { recursive: true }),
    ...periodic.map((path) => mkdir(path, { recursive: true })),
  ]);
  await Promise.all([
    writeFile(join(etc, 'crontab'), '0 * * * * /usr/bin/other\n'),
    writeFile(join(cronD, 'cleanup'), '0 * * * * /usr/bin/other\n'),
    writeFile(join(etc, 'anacrontab'), '1 5 daily /usr/bin/ollama serve\n'),
    ...periodic.map(async (path, index) => {
      const job = join(path, ['hour', 'day', 'week', 'month'][index]);
      await writeFile(job, '#!/bin/sh\n/usr/bin/ollama serve\n');
      await chmod(job, 0o755);
    }),
  ]);
  return { directory, etc, cronD, periodic, spool };
}

function inventoryEnv(fixture) {
  return {
    RETIRE_OLLAMA_CRON_SYSTEM_FILE: join(fixture.etc, 'crontab'),
    RETIRE_OLLAMA_CRON_SYSTEM_DIR: fixture.cronD,
    RETIRE_OLLAMA_CRON_SPOOL_DIR: fixture.spool,
    RETIRE_OLLAMA_ANACRONTAB: join(fixture.etc, 'anacrontab'),
    RETIRE_OLLAMA_CRON_HOURLY_DIR: fixture.periodic[0],
    RETIRE_OLLAMA_CRON_DAILY_DIR: fixture.periodic[1],
    RETIRE_OLLAMA_CRON_WEEKLY_DIR: fixture.periodic[2],
    RETIRE_OLLAMA_CRON_MONTHLY_DIR: fixture.periodic[3],
  };
}

test('includes the fixed periodic and anacron sources in a deterministic inventory', async () => {
  const fixture = await createFixture();
  const manifest = join(fixture.directory, 'manifest');
  try {
    const { stdout } = await shell(
      `${fixtureFunctions()}; OWNER=bassey; load_cron_inventory_helper; cron_inventory_collect_external "$2"; cat "$2"`,
      [manifest],
      inventoryEnv(fixture)
    );
    assert.deepEqual(stdout.trim().split('\n'), [
      `system\t-\t${join(fixture.etc, 'crontab')}`,
      `system-directory\t-\t${join(fixture.cronD, 'cleanup')}`,
      `system\t-\t${join(fixture.etc, 'anacrontab')}`,
      `system-directory\t-\t${join(fixture.periodic[0], 'hour')}`,
      `system-directory\t-\t${join(fixture.periodic[1], 'day')}`,
      `system-directory\t-\t${join(fixture.periodic[2], 'week')}`,
      `system-directory\t-\t${join(fixture.periodic[3], 'month')}`,
    ]);
    const record = await shell(
      `${fixtureFunctions()}; OWNER=bassey; load_cron_inventory_helper; CONSUMER_SCANNERS_LOADED=yes; consumer_canonical_regular() { [ -f "$1" ] && [ ! -L "$1" ] || return 2; printf '%s\\n' "$1"; }; consumer_snapshot() { snapshot=$(temp_path); cat "$1" >"$snapshot"; printf '%s|stable\\n' "$snapshot"; }; consumer_source_identity() { printf 'stable\\n'; }; record_consumers() { :; }; cron_inventory_record_wrapper_consumers() { :; }; records='[]'; record_external_cron_sources; printf '%s\\n' "$records"`,
      [],
      inventoryEnv(fixture)
    );
    const entries = [
      [
        'system-crontab',
        join(fixture.etc, 'crontab'),
        '0 * * * * /usr/bin/other\n',
      ],
      [
        'system-cron-directory',
        join(fixture.cronD, 'cleanup'),
        '0 * * * * /usr/bin/other\n',
      ],
      [
        'system-crontab',
        join(fixture.etc, 'anacrontab'),
        '1 5 daily /usr/bin/ollama serve\n',
      ],
      [
        'system-cron-directory',
        join(fixture.periodic[0], 'hour'),
        '#!/bin/sh\n/usr/bin/ollama serve\n',
      ],
      [
        'system-cron-directory',
        join(fixture.periodic[1], 'day'),
        '#!/bin/sh\n/usr/bin/ollama serve\n',
      ],
      [
        'system-cron-directory',
        join(fixture.periodic[2], 'week'),
        '#!/bin/sh\n/usr/bin/ollama serve\n',
      ],
      [
        'system-cron-directory',
        join(fixture.periodic[3], 'month'),
        '#!/bin/sh\n/usr/bin/ollama serve\n',
      ],
    ];
    assert.deepEqual(
      JSON.parse(record.stdout),
      entries.map(([className, realPath, content]) => ({
        class: className,
        realPath,
        sha256: createHash('sha256').update(content).digest('hex'),
        identitySha256: 'stable',
      }))
    );
  } finally {
    await rm(fixture.directory, { recursive: true, force: true });
  }
});

test('rejects a symlinked periodic command rather than following it outside the fixed root', async () => {
  const fixture = await createFixture();
  try {
    const escaped = join(fixture.directory, 'outside');
    await writeFile(escaped, '#!/bin/sh\n/usr/bin/ollama serve\n');
    await chmod(escaped, 0o755);
    await symlink(escaped, join(fixture.periodic[1], 'escaped'));
    await assert.rejects(
      shell(
        `${fixtureFunctions()}; OWNER=bassey; load_cron_inventory_helper; cron_inventory_collect_external "$2"`,
        [join(fixture.directory, 'manifest')],
        inventoryEnv(fixture)
      ),
      (error) =>
        error.code === 65 && /unsafe daily cron directory/.test(error.stderr)
    );
  } finally {
    await rm(fixture.directory, { recursive: true, force: true });
  }
});
