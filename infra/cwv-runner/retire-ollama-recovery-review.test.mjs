import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
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
const sourceSha = 'b'.repeat(40);
function shellAt(pathname, command, args = [], env = {}) {
  return execFileAsync(
    'sh',
    [
      '-c',
      `. "$1"; SCRIPT_DIR=$(dirname "$1"); RECOVERY_HELPER="$SCRIPT_DIR/retire-ollama-recovery.sh"; . "$RECOVERY_HELPER"; [ -z "\${RETIRE_OLLAMA_RECOVERY_TEST_ROOT:-}" ] || RECOVERY_RECEIPT_ROOT="\${RETIRE_OLLAMA_RECOVERY_TEST_ROOT:-}"; ${command}`,
      'recovery-review-test',
      pathname,
      ...args,
    ],
    { env: { ...process.env, ...env } }
  );
}

function shell(command, args = [], env = {}) {
  return shellAt(script.pathname, command, args, env);
}

async function receiptBin() {
  const directory = await mkdtemp(join(tmpdir(), 'baci-recovery-bin-'));
  await writeFile(
    join(directory, 'sha256sum'),
    '#!/bin/sh\nexec /usr/bin/shasum -a 256 "$@"\n'
  );
  await writeFile(
    join(directory, 'ln'),
    '#!/bin/sh\n[ "$1" = -- ] && shift\nexec /bin/ln "$@"\n'
  );
  await writeFile(
    join(directory, 'readlink'),
    '#!/bin/sh\nif [ "$1" = -f ]; then [ "$2" = -- ] && p=$3 || p=$2; printf "%s\\n" "$' +
      '{RETIRE_OLLAMA_TEST_REALPATH:-$p}"; else exec /usr/bin/readlink "$@"; fi\n'
  );
  await writeFile(
    join(directory, 'stat'),
    `#!${process.execPath}\nconst fs=require('node:fs');const a=process.argv.slice(2),i=a.indexOf('-c'),f=i>=0?a[i+1]:a.find(v=>v.startsWith('--format='))?.slice(9),p=a.at(-1),s=(a.includes('-L')||a.includes('-Lc')?fs.statSync:fs.lstatSync)(p),m=s.mode&0o7777,t=s.mode.toString(16),type=(s.mode&0o170000)===0o040000?'directory':(s.mode&0o170000)===0o120000?'symbolic link':'regular file';const r=(f??'%a').replaceAll('%u',String(s.uid)).replaceAll('%g',String(s.gid)).replaceAll('%a',m.toString(8)).replaceAll('%d',String(s.dev)).replaceAll('%i',String(s.ino)).replaceAll('%f',t).replaceAll('%F',type);process.stdout.write(r+'\\n');\n`
  );
  await Promise.all(
    ['sha256sum', 'ln', 'readlink', 'stat'].map((name) =>
      chmod(join(directory, name), 0o755)
    )
  );
  return directory;
}

test('derives the source identity from the sealed SHA directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'baci-recovery-source-'));
  const sealed = join(root, 'source', sourceSha);
  try {
    await mkdir(sealed, { recursive: true });
    for (const name of [
      'retire-ollama.sh',
      'retire-ollama-recovery.sh',
      'retire-ollama-recovery-receipts.sh',
    ]) {
      await copyFile(new URL(`./${name}`, import.meta.url), join(sealed, name));
    }
    const { stdout } = await shellAt(
      join(sealed, 'retire-ollama.sh'),
      'printf "%s\\n" "$RECOVERY_SOURCE_SHA"'
    );
    assert.equal(stdout.trim(), sourceSha);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('marks a residual-config dpkg package absent', async () => {
  const { stdout } = await shell(
    "recovery_dpkg_query() { printf 'rc  0.1\\n'; }; init_temp_root; trap cleanup_temp EXIT; recovery_package_snapshot"
  );
  assert.deepEqual(JSON.parse(stdout), {
    name: 'ollama',
    state: 'absent',
    version: null,
  });
});

test('accepts the merged-usr executable alias only after canonical resolution', async () => {
  const root = await mkdtemp(join(tmpdir(), 'baci-recovery-alias-'));
  const bin = join(root, 'bin');
  const procRoot = join(root, 'proc');
  const proc = join(procRoot, '41');
  try {
    await mkdir(proc, { recursive: true });
    await mkdir(bin);
    await writeFile(
      join(bin, 'readlink'),
      '#!/bin/sh\ncase "$1" in -f) case "$3" in */missing/ollama) exit 1;; esac; printf "/usr/bin/ollama\\n";; --) printf "/bin/ollama\\n";; *) exit 1;; esac\n'
    );
    await writeFile(
      join(bin, 'sha256sum'),
      '#!/bin/sh\nprintf "%064d  %s\\n" 0 "$2"\n'
    );
    await writeFile(
      join(bin, 'stat'),
      '#!/bin/sh\nprintf "1:2:1000:1000:755\\n"\n'
    );
    await Promise.all(
      ['readlink', 'sha256sum', 'stat'].map((name) =>
        chmod(join(bin, name), 0o755)
      )
    );
    await symlink('/bin/ollama', join(proc, 'exe'));
    await writeFile(
      join(proc, 'stat'),
      `41 (ollama) ${Array.from({ length: 20 }, () => '1').join(' ')}\n`
    );
    await writeFile(join(proc, 'status'), 'Uid:\t1000\t1000\t1000\t1000\n');
    const { stdout } = await shell(
      'RECOVERY_PROC_ROOT="$2"; init_temp_root; trap cleanup_temp EXIT; recovery_process_executable 41 /bin/ollama ollama',
      [procRoot],
      { RETIRE_OLLAMA_TEST_BIN: bin }
    );
    const executable = JSON.parse(stdout);
    assert.equal(executable.path, '/bin/ollama');
    assert.equal(executable.realPath, '/usr/bin/ollama');
    await assert.rejects(
      shell(
        'RECOVERY_PROC_ROOT="$2"; init_temp_root; trap cleanup_temp EXIT; recovery_process_executable 41 /missing/ollama ollama',
        [procRoot],
        { RETIRE_OLLAMA_TEST_BIN: bin }
      ),
      (error) =>
        error.code === 78 && /expectation unresolved/.test(error.stderr)
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('requires the reviewed loopback tuple for the Docker proxy', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-recovery-proxy-'));
  const ports = join(directory, 'ports.json');
  try {
    await writeFile(
      ports,
      '{"NetworkSettings":{"Ports":{"11434/tcp":[{"HostIp":"127.0.0.1","HostPort":"11434"}]},"Networks":{"bridge":{"IPAddress":"172.17.0.2"}}}}\n'
    );
    const { stdout } = await shell(
      'recovery_proxy_ports_ok "docker-proxy -proto tcp -host-ip 127.0.0.1 -host-port 11434 -container-ip 172.17.0.2 -container-port 11434" "$2" && printf loopback || printf public; recovery_proxy_ports_ok "docker-proxy -proto tcp -host-ip 0.0.0.0 -host-port 11434 -container-ip 172.17.0.2 -container-port 11434" "$2" && printf bad || printf rejected',
      [ports]
    );
    assert.deepEqual(stdout.trim().split('\n'), ['loopbackrejected']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('uses one saved process surface instead of invoking ps twice', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'baci-recovery-process-surface-')
  );
  const processes = join(directory, 'processes');
  try {
    const { stdout } = await shell(
      'calls=0; recovery_ps() { calls=$((calls + 1)); if [ "$calls" -eq 1 ]; then printf first; else printf changed; fi; }; recovery_surface() { class=$1; shift; [ "$class" = running-processes ] && "$@"; }; recovery_collect_processes "$2"; printf "\\n%s\\n" "$calls"',
      [processes]
    );
    assert.equal(stdout, 'first\n1\n');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('refuses a changed scan snapshot for an existing receipt pair', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-recovery-drift-'));
  const receiptRoot = join(directory, 'receipts');
  const snapshot = join(directory, 'snapshot.json');
  const bin = await receiptBin();
  await mkdir(receiptRoot, { mode: 0o700 });
  try {
    await writeFile(snapshot, '{"surfaces":[],"dependencies":[]}\n');
    const env = {
      RETIRE_OLLAMA_TEST_BIN: bin,
      RETIRE_OLLAMA_RECOVERY_TEST_ROOT: receiptRoot,
    };
    await shell(
      'fsync_file() { :; }; fsync_dir() { :; }; RECOVERY_SOURCE_SHA="$3"; init_temp_root; trap cleanup_temp EXIT; recovery_write_receipt "$2"',
      [snapshot, sourceSha],
      env
    );
    await writeFile(
      snapshot,
      '{"surfaces":[{"class":"changed"}],"dependencies":[]}\n'
    );
    await assert.rejects(
      shell(
        'fsync_file() { :; }; fsync_dir() { :; }; RECOVERY_SOURCE_SHA="$3"; init_temp_root; trap cleanup_temp EXIT; recovery_write_receipt "$2"',
        [snapshot, sourceSha],
        env
      ),
      (error) => error.code === 78 && /snapshot drift/.test(error.stderr)
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
    await rm(bin, { recursive: true, force: true });
  }
});

test('records post-action absent container and model states without identities', async () => {
  const container = JSON.parse(
    (
      await shell(
        'recovery_docker() { case "$1" in inspect) printf "Error: No such object: ollama-loopback\\n" >&2; return 1;; ps) :;; esac; }; init_temp_root; trap cleanup_temp EXIT; recovery_container_snapshot'
      )
    ).stdout
  );
  const model = JSON.parse(
    (
      await shell(
        'STORE=/missing/ollama; init_temp_root; trap cleanup_temp EXIT; recovery_model_snapshot'
      )
    ).stdout
  );
  assert.deepEqual(container, { name: 'ollama-loopback', state: 'absent' });
  assert.deepEqual(model, { state: 'absent' });
});

test('rejects a Docker transport error instead of recording container absence', async () => {
  await assert.rejects(
    shell(
      'recovery_docker() { printf "Cannot connect to Docker daemon\\n" >&2; return 1; }; init_temp_root; trap cleanup_temp EXIT; recovery_container_snapshot'
    ),
    (error) => error.code === 65 && /inspection failed/.test(error.stderr)
  );
});

test('rejects a lingering Ollama process after container removal', async () => {
  const directory = await mkdtemp(
    join(tmpdir(), 'baci-recovery-absent-process-')
  );
  const processes = join(directory, 'processes');
  try {
    for (const command of ['/usr/bin/ollama serve', 'ollama serve', 'ollama']) {
      await writeFile(processes, `41 1 ${command}\n`);
      await assert.rejects(
        shell('recovery_absent_process_snapshot "$2"', [processes]),
        (error) =>
          error.code === 78 &&
          /foreign Ollama process remains/.test(error.stderr)
      );
    }
    await writeFile(processes, '41 1 /usr/bin/other-service\n');
    const { stdout } = await shell('recovery_absent_process_snapshot "$2"', [
      processes,
    ]);
    assert.deepEqual(JSON.parse(stdout), {
      state: 'absent',
      matchingProcesses: [],
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('parses authentic installed dpkg status bytes without a leading version space', async () => {
  const { stdout } = await shell(
    "recovery_dpkg_query() { printf 'ii  0.1\\n'; }; init_temp_root; trap cleanup_temp EXIT; recovery_package_snapshot"
  );
  assert.deepEqual(JSON.parse(stdout), {
    name: 'ollama',
    state: 'present',
    version: '0.1',
  });
});

test('keeps one process surface when the post-action container is absent', async () => {
  const source = await readFile(
    new URL('./retire-ollama-recovery.sh', import.meta.url),
    'utf8'
  );
  assert.match(
    source,
    /recovery_container_snapshot >"\$container"\n {2}recovery_collect_processes "\$processes"\n {2}if \[ "\$\{RECOVERY_CONTAINER_STATE:-\}" = absent \]/
  );
});
