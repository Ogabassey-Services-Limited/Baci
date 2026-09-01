import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { createSourceArchive } from './source-archive.mjs';

const execFileAsync = promisify(execFile);
const validation = new URL(
  './retire-ollama-running-container-validation.sh',
  import.meta.url
);
const running = new URL('./retire-ollama.sh', import.meta.url);
const imageId = `sha256:${'c'.repeat(64)}`;

test('refreshes the deadline before the terminal filesystem export', async () => {
  const source = await readFile(validation, 'utf8');
  assert.match(
    source,
    /running_filesystem_terminal_started_at=\$\(running_container_now\)[\s\S]*running_filesystem_terminal_deadline=\$\(\(running_filesystem_terminal_started_at \+ RUNNING_CONTAINER_FILESYSTEM_SAVE_TIMEOUT_SECONDS\)\)[\s\S]*running_container_archive_hash_stream container[^\n]*"\$running_filesystem_terminal_deadline"/
  );
});

test('does not treat a clean 4892-byte tar member size as an Ollama marker', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-running-tar-'));
  try {
    const archive = join(directory, 'filesystem.tar');
    await writeFile(
      archive,
      createSourceArchive([
        { bytes: Buffer.alloc(4892, 0x78), mode: '100644', path: 'clean.bin' },
      ])
    );
    const { stdout } = await execFileAsync('sh', [
      '-c',
      '. "$1"; if running_container_archive_matches "$2"; then printf 0; else printf "%s" "$?"; fi',
      'running-container-archive-regression',
      validation.pathname,
      archive,
    ]);
    assert.equal(stdout, '1');
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('rejects unreviewed extended-header member types', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-running-extended-'));
  try {
    const archive = join(directory, 'filesystem.tar');
    const bytes = Buffer.from(
      createSourceArchive([
        { bytes: Buffer.from('ollama'), mode: '100644', path: 'clean.bin' },
      ])
    );
    for (const type of ['x', 'g']) {
      bytes[156] = type.charCodeAt(0);
      bytes.fill(0x20, 148, 156);
      let sum = 0;
      for (const byte of bytes.subarray(0, 512)) sum += byte;
      bytes.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
      await writeFile(archive, bytes);
      await assert.rejects(
        execFileAsync('sh', [
          '-c',
          '. "$1"; running_container_archive_matches "$2"',
          'running-container-extended-header',
          validation.pathname,
          archive,
        ]),
        (error) => error.code === 2
      );
      assert.equal((await readFile(archive))[156], type.charCodeAt(0));
    }
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('records a stopped container whose merged filesystem has an auto-discovered marker', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-stopped-container-'));
  try {
    const archive = join(directory, 'filesystem.tar');
    await writeFile(
      archive,
      createSourceArchive([
        {
          bytes: Buffer.from('upstream=http://127.0.0.1:11434\n'),
          mode: '100644',
          path: 'etc/service/application.conf',
        },
      ])
    );
    const command = `
      . "$1"; SCRIPT_DIR=$(dirname "$1"); RETIRE_OLLAMA_TMPDIR="$2"; RETIRE_OLLAMA_TEST_BIN=/usr/bin; RETIRE_OLLAMA_TEST_FSTYPE=apfs;
      load_temp_root_helper; temp_root_required_bytes() { printf '1\n'; }; init_temp_root; trap cleanup_temp EXIT; CANONICAL_DOCKER_SOCKET=/run/docker.sock; load_consumer_scanners;
      fixture_archive=$3
      docker() { case "$*" in *'{{.Image}} stopped-api'*) printf '%s\\n' '${imageId}';; *'{{json .State.Running}} stopped-api'*) printf '%s\\n' false;; *) return 2;; esac; };
      running_container_now() { printf 0; };
      running_container_archive_save_bounded() { cp "$fixture_archive" "$3"; };
      stopped_container_validate stopped-api stable-config
    `;
    const { stdout } = await execFileAsync('sh', [
      '-c',
      command,
      'stopped-container-filesystem-regression',
      running.pathname,
      directory,
      archive,
    ]);
    assert.match(
      stdout,
      /^stopped-container-filesystem:[0-9a-f]{64}\|[0-9a-f]{64}\|[0-9a-f]{64}$/m
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test('fails closed when the writable filesystem changes after its second export', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-running-terminal-'));
  try {
    const archive = join(directory, 'filesystem.tar');
    await writeFile(
      archive,
      createSourceArchive([
        { bytes: Buffer.from('clean'), mode: '100644', path: 'clean.bin' },
      ])
    );
    const command = `
      . "$1"; SCRIPT_DIR=$(dirname "$1"); RETIRE_OLLAMA_TMPDIR="$2"; RETIRE_OLLAMA_TEST_BIN=/usr/bin; RETIRE_OLLAMA_TEST_FSTYPE=apfs;
      load_temp_root_helper; temp_root_required_bytes() { printf '1\n'; }; init_temp_root; trap cleanup_temp EXIT; CANONICAL_DOCKER_SOCKET=/run/docker.sock; load_consumer_scanners;
      docker() { case "$*" in
        *'{{.Name}} generic-api'*) printf '%s\\n' /generic-api;;
        *'{{json .State.Running}} generic-api'*) printf '%s\\n' true;;
        *'{{.Image}} generic-api'*) printf '%s\\n' '${imageId}';;
        *'{{json .Path}} generic-api'*) printf '%s\\n' '"/bin/service"';;
        *'{{json .Config.WorkingDir}} generic-api'*) printf '%s\\n' '""';;
        *'{{json .Args}} generic-api'*) printf '%s\\n' '[]';;
        *'{{json .Config.Env}} generic-api'*) printf '%s\\n' '[]';;
        *'{{json (index .Config "Healthcheck")}} generic-api'*) printf '%s\\n' null;;
        *'{{json .Mounts}} generic-api'*) printf '%s\\n' '[]';;
        *) return 2;;
      esac; };
      running_container_image_matches_merged() { return 1; };
      sha() { printf '%064d\\n' 0; }; hash_text() { printf '%064d\\n' 0; };
      consumer_matches() { return 1; }; running_container_now() { printf 0; };
      fixture_archive=$3
      running_container_archive_save_bounded() { cp "$fixture_archive" "$3"; };
      running_container_archive_hash_stream() {
        if [ "$1" = image ]; then printf '%064d\\n' 0; return; fi;
        count_file="$RETIRE_OLLAMA_TMPDIR/hash-count"; count=$(cat "$count_file" 2>/dev/null || printf 0); count=$((count + 1)); printf '%s' "$count" >"$count_file";
        if [ "$count" -eq 1 ]; then printf '%064d\\n' 0; else printf '%064d\\n' 1; fi;
      };
      running_container_validate generic-api /generic-api stable-config
    `;
    await assert.rejects(
      execFileAsync('sh', [
        '-c',
        command,
        'running-container-terminal',
        running.pathname,
        directory,
        archive,
      ]),
      (error) => error.code === 2
    );
    assert.equal(await readFile(join(directory, 'hash-count'), 'utf8'), '2');
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
