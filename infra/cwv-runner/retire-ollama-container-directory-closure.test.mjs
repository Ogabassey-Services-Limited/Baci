import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const script = new URL('./retire-ollama.sh', import.meta.url);
const portableFilesystem = `
sha256sum() { /usr/bin/shasum -a 256 "$@"; }
stat() {
  for last do :; done
  case "$*" in
    *'-c %F'*) [ -d "$last" ] && printf 'directory\\n' || printf 'regular file\\n' ;;
    *'-c %d'*) printf '1\\n' ;;
    *'-c %s'*) wc -c <"$last" | tr -d ' ' ;;
    *) printf '1:2:81a4:10:0:0:600\\n' ;;
  esac
}
findmnt() { printf '/ fixture apfs ro\\n'; }
`;

test('traverses a stopped container directory-valued environment path', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-container-environment-directory-'))
  );
  try {
    const { stdout } = await execFileAsync('sh', [
      '-c',
      `${portableFilesystem}
docker() {
  case "$*" in
    *'inspect -f {{json .Config.Env}} generic-api') printf '["CONFIG=/etc/application"]\\n' ;;
    *'inspect -f {{json .Config.WorkingDir}} generic-api') printf '""\\n' ;;
    *'inspect -f {{json .State.Running}} generic-api') printf 'false\\n' ;;
    *'cp generic-api:/etc/application '*) for destination do :; done; mkdir "$destination"; printf 'endpoint=http://127.0.0.1:11434\\n' >"$destination/application.conf" ;;
    *) return 2 ;;
  esac
}
. "$1"; SCRIPT_DIR=$(dirname "$1"); RETIRE_OLLAMA_TMPDIR="$2"; load_consumer_scanners; init_temp_root; trap cleanup_temp EXIT; CANONICAL_DOCKER_SOCKET=/run/docker.sock; container_environment_consumers generic-api '["CONFIG=/etc/application"]'`,
      'retire-ollama-container-environment-directory-test',
      script.pathname,
      directory,
    ]);

    assert.match(
      stdout,
      /^container-bind-directory:generic-api:\/etc\/application\|/m
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('fails closed when find emits a partial bind inventory then fails', async () => {
  const directory = await realpath(
    await mkdtemp(join(tmpdir(), 'baci-container-bind-find-failure-'))
  );
  try {
    await assert.rejects(
      execFileAsync('sh', [
        '-c',
        `${portableFilesystem}
find() { case "$*" in *'-name '*) return 0;; *) printf '%s\\n' "$3"; return 2;; esac; }
. "$1"; SCRIPT_DIR=$(dirname "$1"); RETIRE_OLLAMA_TMPDIR="$2"; load_consumer_scanners; init_temp_root; trap cleanup_temp EXIT; output=$(temp_path); if container_bind_directory_snapshot "$3" "$output"; then exit 5; else status=$?; fi; [ "$status" -eq 2 ] && [ ! -e "$output" ] || exit 4; exit 2`,
        'retire-ollama-container-bind-find-failure-test',
        script.pathname,
        directory,
        directory,
      ]),
      (error) => error.code === 2
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

for (const unsafeName of ['line\nbreak.conf', 'pipe|name.conf']) {
  test(`fails closed for a bind path containing ${JSON.stringify(unsafeName)}`, async () => {
    const directory = await realpath(
      await mkdtemp(join(tmpdir(), 'baci-container-bind-delimiter-'))
    );
    try {
      await writeFile(
        join(directory, unsafeName),
        'endpoint=http://127.0.0.1:11434\n'
      );
      await assert.rejects(
        execFileAsync('sh', [
          '-c',
          `${portableFilesystem}
. "$1"; SCRIPT_DIR=$(dirname "$1"); RETIRE_OLLAMA_TMPDIR="$2"; load_consumer_scanners; init_temp_root; trap cleanup_temp EXIT; output=$(temp_path); if container_bind_directory_snapshot "$3" "$output"; then exit 5; else status=$?; fi; [ "$status" -eq 2 ] && [ ! -e "$output" ] || exit 4; exit 2`,
          'retire-ollama-container-bind-delimiter-test',
          script.pathname,
          directory,
          directory,
        ]),
        (error) => error.code === 2
      );
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
}
