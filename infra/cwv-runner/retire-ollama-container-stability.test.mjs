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
  *'{{.Id}}'*first*) printf 'first /first /bin/true [] [] [] {} {} {}\\n' ;;
  *'{{.Id}}'*second*) printf 'second /second /bin/true [] ["OLLAMA_HOST=http://127.0.0.1:11434"] [] {} {} {}\\n' ;;
  *'{{.Name}}'*first*) printf '/first\\n' ;;
  *'{{.Name}}'*second*) printf '/second\\n' ;;
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
        '. "$1"; SCRIPT_DIR=$(dirname "$1"); init_temp_root; trap cleanup_temp EXIT; CANONICAL_DOCKER_SOCKET=/tmp/docker.sock; scan_container_rows all',
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
  *'{{.Id}}'*) printf '%s /%s /bin/true [] [] [] {} {} {}\\n' "$last" "$last" ;;
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
