import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const controller = await readFile(
  new URL('./exact-run-controller.sh', import.meta.url),
  'utf8'
);

test('bugfix: sampler replacement after validation cannot change the bound sample digest', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'baci-cwv-live-race-'));
  const evidence = path.join(root, 'evidence');
  const directory = path.join(root, 'control');
  const sample = path.join(evidence, 'live-sample.json');
  const validator = path.join(root, 'validator.mjs');
  const wait = controller
    .slice(
      controller.indexOf('\nwait_for_sample()'),
      controller.indexOf('\nadmit()')
    )
    .replace(
      / {2}campaign_directory=.*write_receipt "\$directory\/live-sample-expected\.json" "\$expected"\n/,
      '  :\n'
    )
    .replace(
      'root_file "$EVIDENCE_ROOT/live-sample.json" && [ "$(/usr/bin/stat -c \'%u:%g:%a\' -- "$EVIDENCE_ROOT/live-sample.json")" = 0:10001:640 ] && ',
      'root_file "$EVIDENCE_ROOT/live-sample.json" && '
    )
    .replace('/usr/bin/node', process.execPath);
  try {
    await Promise.all([mkdir(evidence), mkdir(directory)]);
    await Promise.all([
      writeFile(sample, 'validated-A'),
      writeFile(
        validator,
        "import { readFile, writeFile } from 'node:fs/promises';\nconst [sample] = process.argv.slice(2);\nif (await readFile(sample, 'utf8') !== 'validated-A') process.exit(1);\nawait writeFile(process.env.BACI_RACE_SOURCE, 'replacement-B');\n"
      ),
    ]);
    const result = spawnSync(
      '/bin/sh',
      [
        '-c',
        `EVIDENCE_ROOT=${evidence}\nLIVE_SAMPLE_CONTRACT=${validator}\nroot_file() { [ -f "$1" ]; }\nroot_mode() { [ -f "$1" ]; }\ncopy_receipt() { /bin/cp "$1" "$2"; }\ndigest() { /bin/cat "$1"; }\n${wait}\nwait_for_sample ${directory}`,
      ],
      {
        encoding: 'utf8',
        env: { ...process.env, BACI_RACE_SOURCE: sample },
      }
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      await readFile(path.join(directory, 'live-sample.sha256'), 'utf8'),
      'validated-A'
    );
    assert.equal(await readFile(sample, 'utf8'), 'replacement-B');
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});
