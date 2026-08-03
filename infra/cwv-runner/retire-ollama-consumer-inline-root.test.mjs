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

test('binds the base image configuration of an inline Compose Dockerfile', async () => {
  const root = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-compose-inline-'))
  );
  const bin = join(root, 'bin');
  const compose = join(root, 'compose.yaml');
  const imageId = `sha256:${'b'.repeat(64)}`;
  try {
    await mkdir(bin);
    await Promise.all([
      writeFile(
        compose,
        'services:\n  app:\n    build:\n      context: .\n      dockerfile_inline: |\n        FROM generic-inline-base\n        RUN echo ready\n'
      ),
      writeFile(
        join(bin, 'docker'),
        `#!/bin/sh
case "$*" in
  *'image inspect -f '*' generic-inline-base') printf '%s\\n' '${imageId} ["OLLAMA_HOST=http://127.0.0.1:11434"] {} null [] []' ;;
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

    const { stdout } = await execFileAsync(
      'sh',
      [
        '-c',
        `${prelude}. "$1"; SCRIPT_DIR=$(dirname "$1"); COMPOSE_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_compose_definitions`,
        'retire-ollama-compose-inline-test',
        script.pathname,
        root,
      ],
      { env: { ...process.env, RETIRE_OLLAMA_TEST_BIN: bin } }
    );

    assert.match(
      stdout,
      new RegExp(`^compose-inline-build-image:.*${imageId}`, 'm')
    );
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

async function systemdFixture(name, rootImage = false) {
  const directory = await realpath(await mkdtemp(join(tmpdir(), name)));
  const units = join(directory, 'units');
  const executionRoot = join(directory, 'execution-root');
  const rootedBin = join(executionRoot, 'usr', 'bin');
  const unit = join(units, 'application.service');
  const wrapper = join(rootedBin, 'application-worker');
  await Promise.all([mkdir(units), mkdir(rootedBin, { recursive: true })]);
  await Promise.all([
    writeFile(
      unit,
      `[Service]\n${rootImage ? `RootImage=${join(directory, 'root.raw')}\n` : `RootDirectory=${executionRoot}\n`}ExecStart=/usr/bin/application-worker\n`
    ),
    writeFile(
      wrapper,
      '#!/bin/sh\nexec /usr/bin/curl http://127.0.0.1:11434\n'
    ),
  ]);
  await chmod(wrapper, 0o755);
  return { directory, executionRoot, unit, units, wrapper };
}

function scanSystemd(units) {
  return execFileAsync('sh', [
    '-c',
    `${prelude}getent() { return 2; }; systemctl() { return 0; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); SYSTEMD_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_systemd_consumers`,
    'retire-ollama-systemd-root-test',
    script.pathname,
    units,
  ]);
}

test('resolves a stopped systemd wrapper inside RootDirectory', async () => {
  const fixture = await systemdFixture('baci-systemd-root-directory-');
  try {
    const { stdout } = await scanSystemd(fixture.units);
    assert.match(
      stdout,
      new RegExp(`^${fixture.unit}\\|.*\\|${fixture.wrapper}\\|`, 'm')
    );
  } finally {
    await rm(fixture.directory, { force: true, recursive: true });
  }
});

test('fails closed for a stopped systemd wrapper inside RootImage', async () => {
  const fixture = await systemdFixture('baci-systemd-root-image-', true);
  try {
    await writeFile(
      join(fixture.directory, 'root.raw'),
      'sealed image placeholder\n'
    );
    await assert.rejects(
      scanSystemd(fixture.units),
      (error) => error.code === 2
    );
  } finally {
    await rm(fixture.directory, { force: true, recursive: true });
  }
});

test('resolves an active systemd wrapper inside its reported RootDirectory', async () => {
  const fixture = await systemdFixture('baci-systemd-runtime-root-');
  try {
    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}execution_root=$2; . "$1"; SCRIPT_DIR=$(dirname "$1"); load_consumer_scanners; init_temp_root; trap cleanup_temp EXIT; systemd_runtime_inventory() { printf 'application.service loaded active running fixture\\n' >"$2"; }; systemd_manager_call() { printf 'RootDirectory=%s\\nRootImage=\\nEnvironment=\\nEnvironmentFiles=\\nLoadCredential=\\nLoadCredentialEncrypted=\\nStandardInput=null\\nExecStart={ path=/usr/bin/application-worker ; argv[]=/usr/bin/application-worker ; }\\n' "$execution_root"; }; scan_systemd_runtime_consumers system`,
      'retire-ollama-systemd-runtime-root-test',
      script.pathname,
      fixture.executionRoot,
    ]);
    assert.match(
      stdout,
      new RegExp(`^application\\.service:.*${fixture.wrapper}`, 'm')
    );
  } finally {
    await rm(fixture.directory, { force: true, recursive: true });
  }
});

test('binds a stopped wrapper absolute configuration argument', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-config-argument-'))
  );
  const units = join(directory, 'units');
  const unit = join(units, 'application.service');
  const wrapper = join(directory, 'application-worker');
  const configuration = join(directory, 'application.conf');
  try {
    await mkdir(units);
    await Promise.all([
      writeFile(
        unit,
        `[Service]\nExecStart=${wrapper} --config ${configuration}\n`
      ),
      writeFile(wrapper, '#!/bin/sh\nexec /bin/true\n'),
      writeFile(configuration, 'OLLAMA_HOST=http://127.0.0.1:11434\n'),
    ]);
    await chmod(wrapper, 0o755);
    const { stdout } = await scanSystemd(units);
    assert.match(
      stdout,
      new RegExp(`^${unit}\\|.*\\|${configuration}\\|`, 'm')
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
