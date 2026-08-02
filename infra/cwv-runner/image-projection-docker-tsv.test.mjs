import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const dockerfile = readFileSync(new URL('Dockerfile', import.meta.url), 'utf8');
const projectionScript = dockerfile.match(
  /node --input-type=module -e '([^']+)' "\$projection" \/runtime-root\/opt\/baci-cwv\/rootfs-projection\.json/
)?.[1];

test('parses real TSV projection rows and orders paths by direct comparison', (t) => {
  assert.ok(projectionScript);
  const directory = mkdtempSync(join(tmpdir(), 'rootfs-projection-tsv-'));
  t.after(() => rmSync(directory, { force: true, recursive: true }));
  const input = join(directory, 'projection.tsv');
  const output = join(directory, 'projection.json');
  writeFileSync(
    input,
    'generated\tdirectory\tusr/bin/a\npackage\tbash\tusr/bin/A\n'
  );
  execFileSync(process.execPath, [
    '--input-type=module',
    '-e',
    projectionScript,
    input,
    output,
  ]);
  assert.deepEqual(JSON.parse(readFileSync(output, 'utf8')), {
    entries: [
      { kind: 'package', owner: 'bash', path: 'usr/bin/A' },
      { kind: 'generated', owner: 'directory', path: 'usr/bin/a' },
    ],
    schemaVersion: 1,
  });
});
