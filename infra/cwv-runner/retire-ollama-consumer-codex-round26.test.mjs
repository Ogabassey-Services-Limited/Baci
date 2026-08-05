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
import { dirname, join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);
const prelude =
  'sha256sum() { /usr/bin/shasum -a 256 "$@"; }; stat() { printf "1:2:81a4:10:0:0:600\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; ';

async function staticEnvironmentFixture({
  name,
  environment,
  target,
  template = false,
}) {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-relative-environment-'))
  );
  const units = join(directory, 'units');
  const executionRoot = join(directory, 'execution-root');
  const worker = join(executionRoot, 'usr/bin/application-worker');
  const config = join(executionRoot, target);
  await Promise.all([
    mkdir(units),
    mkdir(dirname(worker), { recursive: true }),
    mkdir(dirname(config), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(worker, '#!/bin/sh\nexit 0\n', { mode: 0o755 }),
    writeFile(config, 'endpoint=http://127.0.0.1:11434\n'),
    writeFile(
      join(units, template ? 'application@.service' : name),
      `[Service]\nRootDirectory=${executionRoot}\nWorkingDirectory=/opt/application\nEnvironment=CONFIG=${environment}\nExecStart=/usr/bin/application-worker\n`
    ),
  ]);
  if (template) await symlink('application@.service', join(units, name));
  return { config, directory, units };
}

function scanStaticEnvironment(fixture) {
  return execFileAsync('sh', [
    '-c',
    `${prelude}getent() { return 2; }; systemctl() { return 0; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); SYSTEMD_ROOTS="$2"; init_temp_root; trap cleanup_temp EXIT; scan_systemd_consumers`,
    'retire-ollama-systemd-relative-environment-test',
    script.pathname,
    fixture.units,
  ]);
}

test('resolves a stopped unit relative Environment path from WorkingDirectory', async () => {
  const fixture = await staticEnvironmentFixture({
    name: 'application.service',
    environment: 'application.conf',
    target: 'opt/application/application.conf',
  });
  try {
    assert.match(
      (await scanStaticEnvironment(fixture)).stdout,
      new RegExp(`\\|${fixture.config}\\|`)
    );
  } finally {
    await rm(fixture.directory, { force: true, recursive: true });
  }
});

test('expands a safe instance specifier in a stopped template Environment path', async () => {
  const fixture = await staticEnvironmentFixture({
    name: 'application@blue.service',
    environment: '/etc/%i/application.conf',
    target: 'etc/blue/application.conf',
    template: true,
  });
  try {
    assert.match(
      (await scanStaticEnvironment(fixture)).stdout,
      new RegExp(`\\|${fixture.config}\\|`)
    );
  } finally {
    await rm(fixture.directory, { force: true, recursive: true });
  }
});

test('binds a file-valued runtime systemd Environment assignment', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-systemd-runtime-environment-'))
  );
  const worker = join(directory, 'application-worker');
  const config = join(directory, 'application.conf');
  try {
    await Promise.all([
      writeFile(worker, '#!/bin/sh\nexit 0\n', { mode: 0o755 }),
      writeFile(config, 'endpoint=http://127.0.0.1:11434\n'),
    ]);
    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}runtime_config=$2; runtime_worker=$3; . "$1"; SCRIPT_DIR=$(dirname "$1"); load_consumer_scanners; init_temp_root; trap cleanup_temp EXIT; systemd_runtime_inventory() { printf 'application.service loaded inactive dead fixture\\n' >"$2"; }; systemd_manager_call() { printf 'RootDirectory=\\nRootImage=\\nWorkingDirectory=\\nEnvironment=CONFIG=%s\\nEnvironmentFiles=\\nLoadCredential=\\nLoadCredentialEncrypted=\\nStandardInput=null\\nExecStart={ path=%s ; argv[]=%s ; }\\n' "$runtime_config" "$runtime_worker" "$runtime_worker"; }; scan_systemd_runtime_consumers system`,
      'retire-ollama-systemd-runtime-environment-test',
      script.pathname,
      config,
      worker,
    ]);
    assert.match(
      stdout,
      new RegExp(`^application\\.service:${config}\\|`, 'm')
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('resolves a stopped container relative Env path from Config.WorkingDir', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-container-relative-environment-'))
  );
  try {
    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${prelude}docker() { case "$*" in *' ps -a '*) printf 'generic-api\\n' ;; *'inspect -f {{.Name}} generic-api') printf '/generic-api\\n' ;; *'inspect -f {{json .State.Running}} generic-api') printf 'false\\n' ;; *'inspect -f {{json .Config.Env}} generic-api') printf '["CONFIG=application.conf"]\\n' ;; *'inspect -f {{json .Config.WorkingDir}} generic-api') printf '"/opt/application"\\n' ;; *'inspect -f {{json .Args}} generic-api') printf '[]\\n' ;; *'inspect -f {{json .Mounts}} generic-api') printf '[]\\n' ;; *'inspect -f {{.Id}} '*) printf 'generic-api /generic-api /usr/bin/application-worker [] ["CONFIG=application.conf"] "/opt/application" {} null [] {} {} {} [] "bridge"\\n' ;; *' cp generic-api:/usr/bin/application-worker '*) for destination do :; done; printf '#!/bin/sh\\nexit 0\\n' >"$destination" ;; *' cp generic-api:/opt/application/application.conf '*) for destination do :; done; printf 'endpoint=http://127.0.0.1:11434\\n' >"$destination" ;; *) return 2 ;; esac; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); RETIRE_OLLAMA_TMPDIR="$2"; init_temp_root; trap cleanup_temp EXIT; CANONICAL_DOCKER_SOCKET=/run/docker.sock; CONTAINER=ollama-loopback; scan_container_rows all`,
      'retire-ollama-container-relative-environment-test',
      script.pathname,
      directory,
    ]);
    assert.match(
      stdout,
      /container-argument:generic-api:\/opt\/application\/application\.conf/
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

async function scanBindDirectory(contents, mutateMounts = false) {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-container-bind-directory-'))
  );
  const source = join(directory, 'application-config');
  await mkdir(source);
  await writeFile(join(source, 'application.conf'), contents);
  try {
    return await execFileAsync('sh', [
      '-c',
      `bind_source=$3; mutate_mounts=$4; mount_calls=0; sha256sum() { /usr/bin/shasum -a 256 "$@"; }; stat() { for last do :; done; case "$*" in *'-c %F'*) [ -d "$last" ] && printf 'directory\\n' || printf 'regular file\\n' ;; *'-c %d'*) printf '1\\n' ;; *'-c %s'*) wc -c <"$last" | tr -d ' ' ;; *) printf '1:2:81a4:10:0:0:600\\n' ;; esac; }; findmnt() { printf '/ fixture apfs ro\\n'; }; docker() { mount_calls=$((mount_calls + 1)); if [ "$mutate_mounts" = yes ] && [ "$mount_calls" -gt 2 ]; then printf '[]\\n'; else printf '[{"Type":"bind","Source":"%s","Destination":"/etc/application"}]\\n' "$bind_source"; fi; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); load_consumer_scanners; init_temp_root; trap cleanup_temp EXIT; CANONICAL_DOCKER_SOCKET=/run/docker.sock; container_bind_mount_consumers generic-api`,
      'retire-ollama-container-bind-directory-test',
      script.pathname,
      directory,
      source,
      mutateMounts ? 'yes' : 'no',
    ]);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

test('accepts a clean stopped-container directory bind mount', async () => {
  assert.equal(
    (await scanBindDirectory('endpoint=http://127.0.0.1:8080\n')).stdout,
    ''
  );
});

test('binds endpoint-bearing files inside a stopped-container directory mount', async () => {
  assert.match(
    (await scanBindDirectory('endpoint=http://127.0.0.1:11434\n')).stdout,
    /^container-bind-directory:generic-api:/m
  );
});

test('fails closed when a directory bind mount changes after traversal', async () => {
  await assert.rejects(
    scanBindDirectory('endpoint=http://127.0.0.1:11434\n', true),
    (error) => error.code === 2
  );
});

async function scanBindDirectoryLimit(mode) {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-container-bind-limit-'))
  );
  const source = join(directory, 'application-config');
  await mkdir(source);
  await writeFile(
    join(source, 'application.conf'),
    'endpoint=http://127.0.0.1:8080\n'
  );
  try {
    return await execFileAsync('sh', [
      '-c',
      `bind_source=$3; marker=$2/limit-too-late; mutation=$2/add-large; sha256sum() { /usr/bin/shasum -a 256 "$@"; }; stat() { for last do :; done; case "$*" in *'-c %F'*) [ -d "$last" ] && printf 'directory\\n' || printf 'regular file\\n' ;; *'-c %d'*) printf '1\\n' ;; *'-c %s'*) case "$last" in */large) printf '67108865\\n';; *) printf '0\\n';; esac ;; *) printf '1:2:81a4:10:0:0:600\\n' ;; esac; }; readlink() { if [ "$1" = -f ]; then case "$2" in "$bind_source"/virtual-*|"$bind_source"/large) printf '%s\\n' "$2";; *) /usr/bin/readlink "$@";; esac; else /usr/bin/readlink "$@"; fi; }; findmnt() { printf '/ fixture apfs ro\\n'; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); load_consumer_scanners; init_temp_root; trap cleanup_temp EXIT; consumer_file_fingerprint() { case "$1" in */large) : >"$marker";; esac; printf '%s|hash|identity\\n' "$1"; }; if [ "$4" = first-count ]; then rm() { for candidate do if [ -f "$candidate" ] && [ "$(wc -l <"$candidate" | tr -d ' ')" -gt 4096 ]; then : >"$marker"; fi; done; /bin/rm "$@"; }; find() { printf '%s\\n' "$bind_source"; index=0; while [ "$index" -lt 5000 ]; do printf '%s/virtual-%s\\n' "$bind_source" "$index" || exit 2; index=$((index + 1)); done; }; else find() { printf '%s\\n%s/application.conf\\n' "$bind_source" "$bind_source"; [ ! -e "$mutation" ] || printf '%s/large\\n' "$bind_source"; }; consumer_matched_fingerprint() { : >"$mutation"; return 1; }; fi; if container_bind_directory_consumers generic-api "$bind_source" /etc/application; then exit 5; else status=$?; fi; [ "$status" -eq 2 ] && [ ! -e "$marker" ] || exit 3; exit 2`,
      'retire-ollama-container-bind-limit-test',
      script.pathname,
      directory,
      source,
      mode,
    ]);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
}

test('fails during first bind enumeration before retaining over 4096 files', async () => {
  await assert.rejects(
    scanBindDirectoryLimit('first-count'),
    (error) => error.code === 2
  );
});

test('fails during second bind enumeration when contents grow past 64 MiB', async () => {
  await assert.rejects(scanBindDirectoryLimit('second-bytes'), (error) => {
    assert.equal(error.code, 2);
    return true;
  });
});
