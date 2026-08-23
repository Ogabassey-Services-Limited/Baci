import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);
const unprivileged = process.getuid?.() === 0 ? { gid: 65534, uid: 65534 } : {};

test('re-enumerates stopped containers added after the initial inventory', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-container-stability-'));
  const bin = join(directory, 'bin');
  const state = join(directory, 'state');
  const log = join(directory, 'docker.log');
  try {
    await mkdir(bin);
    await writeFile(
      join(bin, 'docker'),
      `#!/bin/sh
case "$*" in
  *'ps -a '*)
    if [ -e '${state}' ]; then printf 'first\\nsecond\\n'; else : >'${state}'; printf 'first\\n'; fi ;;
  *'{{.Id}}'*first*) printf 'first /first /bin/true [] [] "" {} null [] {} {} {} [] "bridge"\\n' ;;
  *'{{.Id}}'*second*) printf 'second /second /bin/true [] ["OLLAMA_HOST=http://127.0.0.1:11434"] "" {} null [] {} {} {} [] "bridge"\\n' ;;
  *'{{.Name}}'*first*) printf '/first\\n' ;;
  *'{{.Name}}'*second*) printf '/second\\n' ;;
  *'{{json .Config.Env}}'*first*) printf '[]\\n' ;;
  *'{{json .Config.Env}}'*second*) printf '["OLLAMA_HOST=http://127.0.0.1:11434"]\\n' ;;
  *'{{json .Config.WorkingDir}}'*) printf '""\\n' ;;
  *'{{json .State.Running}}'*) printf 'false\\n' ;;
  *' cp first:/bin/true '*|*' cp second:/bin/true '*) for destination do :; done; printf '#!/bin/sh\\nexit 0\\n' >"$destination" ;;
  *'{{json .Mounts}}'*) printf '[]\\n' ;;
esac
printf '%s\\n' "$*" >>'${log}'
`
    );
    await Promise.all([
      chmod(join(bin, 'docker'), 0o755),
      chmod(directory, 0o777),
    ]);
    const { stdout } = await execFileAsync(
      'sh',
      [
        '-c',
        'sha256sum() { /usr/bin/shasum -a 256 "$@"; }; stat() { printf "1:2:81a4:17:501:20:644\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); init_temp_root; trap cleanup_temp EXIT; CANONICAL_DOCKER_SOCKET=/tmp/docker.sock; scan_container_rows all',
        'retire-ollama-container-stability-test',
        script.pathname,
      ],
      { ...unprivileged, env: { ...process.env, RETIRE_OLLAMA_TEST_BIN: bin } }
    );
    assert.match(
      stdout,
      /second \/second .*OLLAMA_HOST/,
      await readFile(log, 'utf8')
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('accepts a stable mount set returned in alternating orders', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'baci-container-mount-order-')
  );
  const bin = join(directory, 'bin');
  const mountState = join(directory, 'mount-state');
  try {
    await mkdir(bin);
    await writeFile(
      join(bin, 'docker'),
      `#!/bin/sh
mounts_a='[{"Type":"bind","Name":"","Source":"/var/run/docker.sock","Destination":"/var/run/docker.sock","Driver":"","Mode":"rw","RW":true,"Propagation":"rprivate"},{"Type":"tmpfs","Name":"","Source":"","Destination":"/tmp/a","Driver":"","Mode":"","RW":true,"Propagation":""}]'
mounts_b='[{"Type":"tmpfs","Name":"","Source":"","Destination":"/tmp/a","Driver":"","Mode":"","RW":true,"Propagation":""},{"Type":"bind","Name":"","Source":"/var/run/docker.sock","Destination":"/var/run/docker.sock","Driver":"","Mode":"rw","RW":true,"Propagation":"rprivate"}]'
case "$*" in
  *'ps -a '*) printf 'generic-api\n' ;;
  *'{{.Id}}'*) case "$*" in *'{{json .Mounts}}'*) count=$(cat '${mountState}' 2>/dev/null || printf 0); count=$((count + 1)); printf '%s' "$count" >'${mountState}'; if [ $((count % 2)) -eq 1 ]; then mounts=$mounts_a; else mounts=$mounts_b; fi; printf 'generic-api /generic-api /bin/true [] ["DOCKER_SOCK=/var/run/docker.sock"] "" {} null %s {} {} {} [] "bridge"\n' "$mounts";; *) printf 'generic-api /generic-api /bin/true [] ["DOCKER_SOCK=/var/run/docker.sock"] "" {} null {} {} {} [] "bridge"\n';; esac ;;
  *'{{.Name}}'*) printf '/generic-api\n' ;;
  *'{{json .State.Running}}'*) printf 'false\n' ;;
  *'{{json .Config.Env}}'*) printf '["DOCKER_SOCK=/var/run/docker.sock"]\n' ;;
  *'{{json .Config.WorkingDir}}'*) printf '""\n' ;;
  *'{{json .Mounts}}'*) count=$(cat '${mountState}' 2>/dev/null || printf 0); count=$((count + 1)); printf '%s' "$count" >'${mountState}'; if [ $((count % 2)) -eq 1 ]; then printf '%s\n' "$mounts_a"; else printf '%s\n' "$mounts_b"; fi ;;
  *' cp generic-api:/bin/true '*) for destination do :; done; printf '#!/bin/sh\nexit 0\n' >"$destination" ;;
esac
`
    );
    await Promise.all([
      chmod(join(bin, 'docker'), 0o755),
      chmod(directory, 0o777),
    ]);
    const { stdout } = await execFileAsync(
      'sh',
      [
        '-c',
        'sha256sum() { /usr/bin/shasum -a 256 "$@"; }; stat() { printf "1:2:81a4:17:501:20:644\\n"; }; findmnt() { printf "/ fixture apfs ro\\n"; }; . "$1"; SCRIPT_DIR=$(dirname "$1"); init_temp_root; trap cleanup_temp EXIT; CANONICAL_DOCKER_SOCKET=/tmp/docker.sock; scan_container_rows all',
        'retire-ollama-container-mount-order-test',
        script.pathname,
      ],
      { ...unprivileged, env: { ...process.env, RETIRE_OLLAMA_TEST_BIN: bin } }
    );
    assert.equal(stdout, '');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('fails closed after bounded container inventory churn', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-container-churn-'));
  const bin = join(directory, 'bin');
  const state = join(directory, 'state');
  try {
    await mkdir(bin);
    await writeFile(
      join(bin, 'docker'),
      `#!/bin/sh
last=''
for argument do last=$argument; done
case "$*" in
  *'ps -a '*)
    count=$(cat '${state}' 2>/dev/null || printf 0)
    count=$((count + 1))
    [ "$count" -lt 7 ] || exit 79
    printf '%s' "$count" >'${state}'
    /usr/bin/awk -v count="$count" 'BEGIN { for (item = 1; item <= count; item++) printf "container-%s\\n", item }' ;;
  *'{{.Id}}'*) printf '%s /%s /bin/true [] [] [] {} {} {} [] "bridge"\\n' "$last" "$last" ;;
  *'{{.Name}}'*) printf '/%s\\n' "$last" ;;
  *'{{json .Mounts}}'*) printf '[]\\n' ;;
esac
`
    );
    await Promise.all([
      chmod(join(bin, 'docker'), 0o755),
      chmod(directory, 0o777),
    ]);
    await assert.rejects(
      execFileAsync(
        'sh',
        [
          '-c',
          '. "$1"; SCRIPT_DIR=$(dirname "$1"); init_temp_root; trap cleanup_temp EXIT; CANONICAL_DOCKER_SOCKET=/tmp/docker.sock; scan_container_rows all',
          'retire-ollama-container-churn-test',
          script.pathname,
        ],
        {
          ...unprivileged,
          env: { ...process.env, RETIRE_OLLAMA_TEST_BIN: bin },
        }
      ),
      (error) => error.code === 2
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
