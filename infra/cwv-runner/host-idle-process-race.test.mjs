import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const source = await readFile(
  new URL('./host-idle-check.sh', import.meta.url),
  'utf8'
);
const embedded =
  /^processes\(\) \{\n[\s\S]*?<<'NODE'\n([\s\S]*?)\nNODE\n\}$/m.exec(
    source
  )?.[1];
assert.ok(embedded, 'process inventory collector must be embedded');

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'host-idle-proc-'));
  const proc = path.join(root, 'proc');
  const cgroup = path.join(root, 'cgroup');
  const binary = path.join(root, 'stable-process');
  const map = path.join(root, 'process-map.json');
  const script = path.join(root, 'processes.mjs');
  await mkdir(path.join(proc, '100'), { recursive: true });
  await mkdir(path.join(cgroup, 'fixture.slice'), { recursive: true });
  await writeFile(binary, 'stable');
  await writeFile(path.join(proc, '100/stat'), '100 (stable) S 0 0 0\n');
  await writeFile(path.join(proc, '100/cgroup'), '0::/fixture.slice\n');
  await symlink(binary, path.join(proc, '100/exe'));
  await writeFile(
    path.join(cgroup, 'fixture.slice/cpuset.cpus.effective'),
    '0-1\n'
  );
  await symlink(path.join(root, 'exited'), path.join(proc, '101'));
  await writeFile(map, '{"entries":[],"sealed":[]}');
  await writeFile(
    script,
    embedded
      .replace(
        "fs.readdirSync('/proc')",
        `fs.readdirSync(${JSON.stringify(proc)})`
      )
      .replaceAll('/proc/', `${proc}/`)
      .replaceAll('/sys/fs/cgroup', cgroup)
  );
  return { binary: await realpath(binary), map, proc, root, script };
}

async function writeStableProcess(
  value,
  pid,
  { cgroup = true, exe = true } = {}
) {
  const processDirectory = path.join(value.proc, String(pid));
  await mkdir(processDirectory, { recursive: true });
  await writeFile(
    path.join(processDirectory, 'stat'),
    `${pid} (stable) S 0 0 0\n`
  );
  if (cgroup) {
    await writeFile(
      path.join(processDirectory, 'cgroup'),
      '0::/fixture.slice\n'
    );
  }
  if (exe) {
    await symlink(value.binary, path.join(processDirectory, 'exe'));
  }
}

test('skips only ENOENT and ESRCH when a listed host PID exits', async () => {
  const value = await fixture();
  const result = spawnSync(process.execPath, [value.script, value.map], {
    encoding: 'utf8',
  });
  await rm(value.root, { force: true, recursive: true });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    result.stdout,
    `100|0|${value.binary}|-|/fixture.slice|0-1|-|-\n`
  );
  assert.match(
    embedded,
    /error\?\.code === 'ENOENT' \|\| error\?\.code === 'ESRCH'/
  );
});

test('fails closed when a listed PID survives an ENOENT identity read', async (t) => {
  for (const [name, options] of [
    ['cgroup', { cgroup: false }],
    ['cpuset', {}],
    ['executable', { exe: false }],
  ]) {
    await t.test(`missing ${name} data`, async () => {
      const value = await fixture();
      await unlink(path.join(value.proc, '101'));
      if (name === 'cpuset') {
        await rm(path.join(value.root, 'cgroup', 'fixture.slice'), {
          force: true,
          recursive: true,
        });
      }
      await writeStableProcess(value, 101, options);
      const result = spawnSync(process.execPath, [value.script, value.map], {
        encoding: 'utf8',
      });
      await rm(value.root, { force: true, recursive: true });

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /ENOENT|no such file or directory/i);
    });
  }
});

test('still refuses a non-race proc read failure', async () => {
  const value = await fixture();
  await unlink(path.join(value.proc, '101'));
  await mkdir(path.join(value.proc, '102'));
  await mkdir(path.join(value.proc, '102/stat'));
  const result = spawnSync(process.execPath, [value.script, value.map], {
    encoding: 'utf8',
  });
  await rm(value.root, { force: true, recursive: true });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /EISDIR|illegal operation on a directory/);
});
