import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  chmod,
  link,
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

function shell(command, args = [], env = {}) {
  return execFileAsync(
    'sh',
    [
      '-c',
      `. "$1"; SCRIPT_DIR=$(dirname "$1"); . "$SCRIPT_DIR/retire-ollama-recovery.sh"; ${command}`,
      'retire-ollama-recovery-exec-swap-test',
      script.pathname,
      ...args,
    ],
    { env: { ...process.env, ...env } }
  );
}

async function createTestBin() {
  const directory = await mkdtemp(join(tmpdir(), 'baci-recovery-exec-bin-'));
  await Promise.all([
    writeFile(
      join(directory, 'sha256sum'),
      '#!/bin/sh\nexec /usr/bin/shasum -a 256 "$@"\n'
    ),
    writeFile(
      join(directory, 'readlink'),
      `#!${process.execPath}\nconst fs=require('node:fs');const a=process.argv.slice(2),p=a.at(-1);if(a[0]==='-f')process.stdout.write(fs.realpathSync(p)+'\\n');else if(a[0]==='--')process.stdout.write(fs.readlinkSync(p)+'\\n');else process.exit(1);\n`
    ),
    writeFile(
      join(directory, 'stat'),
      `#!${process.execPath}\nconst fs=require('node:fs');const a=process.argv.slice(2),p=a.at(-1),s=(a.includes('-L')||a.includes('-Lc')?fs.statSync:fs.lstatSync)(p),m=s.mode&0o7777,f=(a[a.indexOf('-c')+1]??'%a');process.stdout.write(f.replaceAll('%u',String(s.uid)).replaceAll('%g',String(s.gid)).replaceAll('%a',m.toString(8)).replaceAll('%d',String(s.dev)).replaceAll('%i',String(s.ino))+'\\n');\n`
    ),
  ]);
  await Promise.all(
    ['sha256sum', 'readlink', 'stat'].map((name) =>
      chmod(join(directory, name), 0o755)
    )
  );
  return directory;
}

async function createProcessFixture() {
  const directory = await mkdtemp(join(tmpdir(), 'baci-recovery-exec-swap-'));
  const process = join(directory, 'proc', '41');
  const bin = join(process, 'root', 'bin');
  const executable = join(process, 'exe');
  const expected = join(bin, 'ollama');
  const pinned = join(bin, 'pinned');
  const replacement = join(bin, 'replacement');

  await mkdir(bin, { recursive: true });
  await Promise.all([
    writeFile(pinned, '#!/bin/sh\nexit 0\n'),
    writeFile(replacement, '#!/bin/sh\nexit 1\n'),
    writeFile(join(process, 'status'), 'Uid:\t1000\t1000\t1000\t1000\n'),
    writeFile(
      join(process, 'stat'),
      `41 (ollama) ${Array.from({ length: 19 }, () => '0').join(' ')} 1\n`
    ),
  ]);
  await chmod(pinned, 0o755);
  await chmod(replacement, 0o755);
  await link(pinned, expected);
  await symlink(pinned, executable);

  return { directory, expected, proc: join(directory, 'proc') };
}

test('fails closed when a process exec changes at the executable hash boundary', async () => {
  const fixture = await createProcessFixture();
  const bin = await createTestBin();
  try {
    await assert.rejects(
      shell(
        'RECOVERY_PROC_ROOT="$2"; sha() { if [ "$1" = "$RECOVERY_PROC_ROOT/41/exe" ]; then rm -f -- "$1"; ln -s "$RECOVERY_PROC_ROOT/41/root/bin/replacement" "$1"; fi; sha256sum "$1" | awk \'{print $1}\'; }; recovery_process_executable 41 /bin/ollama ollama',
        [fixture.proc],
        { RETIRE_OLLAMA_TEST_BIN: bin }
      ),
      (error) =>
        error.code === 78 && /process executable changed/.test(error.stderr)
    );
  } finally {
    await rm(fixture.directory, { recursive: true, force: true });
    await rm(bin, { recursive: true, force: true });
  }
});

test('fails closed when the expected path rebinds at the executable hash boundary', async () => {
  const fixture = await createProcessFixture();
  const bin = await createTestBin();
  try {
    await assert.rejects(
      shell(
        'expected_path="$2"; RECOVERY_PROC_ROOT="$3"; sha() { if [ "$1" = "$RECOVERY_PROC_ROOT/41/exe" ]; then rm -f -- "$expected_path"; ln -s "$RECOVERY_PROC_ROOT/41/root/bin/replacement" "$expected_path"; fi; sha256sum "$1" | awk \'{print $1}\'; }; recovery_process_executable 41 /bin/ollama ollama',
        [fixture.expected, fixture.proc],
        { RETIRE_OLLAMA_TEST_BIN: bin }
      ),
      (error) =>
        error.code === 78 &&
        /process executable expectation changed/.test(error.stderr)
    );
  } finally {
    await rm(fixture.directory, { recursive: true, force: true });
    await rm(bin, { recursive: true, force: true });
  }
});
