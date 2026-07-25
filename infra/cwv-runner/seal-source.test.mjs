import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const path = new URL('./seal-source.sh', import.meta.url).pathname;
const source = readFileSync(path, 'utf8');
const shell = (...args) => spawnSync('/bin/bash', args, { encoding: 'utf8' });

test('is syntactically valid and refuses incomplete arguments before a mutation path', () => {
  assert.equal(shell('-n', path).status, 0);
  const result = shell(path, '--destination', 'final');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /usage/);
});

test('uses a fixed privileged Bash that ignores environment-selected startup code', () => {
  assert.match(source, /^#!\/bin\/bash -p\n/);
  const root = mkdtempSync(join(tmpdir(), 'baci-cwv-bash-env-'));
  const startup = join(root, 'startup.sh');
  writeFileSync(
    startup,
    "printf 'environment startup code ran\\n' >&2\n",
    'utf8'
  );
  try {
    const result = spawnSync(path, ['--destination', 'final'], {
      encoding: 'utf8',
      env: { ...process.env, BASH_ENV: startup },
    });
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stderr, /environment startup code ran/);
    assert.match(result.stderr, /usage/);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('uses only closed flags, fixed tools, root copy checks, and atomic destinations', () => {
  for (const flag of [
    '--destination',
    '--source-sha',
    '--source-archive',
    '--source-archive-sha256',
    '--source-manifest',
    '--source-manifest-sha256',
  ])
    assert.match(source, new RegExp(flag));
  for (const literal of [
    '/bin/cp',
    '/usr/bin/stat',
    '/usr/bin/sha256sum',
    '/bin/chown',
    '/bin/chmod',
    '/var/lib/baci-cwv/preflight-source',
    '/srv/baci-cwv/source',
    '/srv/baci-cwv/source-receipts',
  ])
    assert.match(
      source,
      new RegExp(literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    );
  assert.match(source, /input is not a regular file/);
  assert.match(source, /root-copied input digest mismatch/);
  assert.match(source, /sealed destination already exists/);
  assert.match(source, /--no-same-owner --no-same-permissions --no-recursion/);
});

test('seals only a complete regular-file archive projection and rejects unsafe members', () => {
  for (const refusal of [
    'unsafe archive member name',
    'nonregular extracted member',
    'hardlinked extracted member',
    'archive member set mismatch',
    'extracted member hash mismatch',
    'manifest archive rows are not sorted',
  ])
    assert.match(source, new RegExp(refusal));
  assert.match(source, /sourceArchive/);
  assert.match(source, /reviewedHeadSha/);
  assert.match(source, /mergeSha/);
  assert.match(source, /trap cleanup EXIT HUP INT TERM/);
});

test('self-copies and raw-hash-verifies the first root helper before inner execution', () => {
  for (const token of [
    'BACI_CWV_SEAL_SOURCE_RAW_SHA',
    '--sealed-inner',
    'helper raw digest mismatch',
    'helper is not a regular file',
    '0500',
    '0700',
  ])
    assert.match(
      source,
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    );
});

test('binds the sealed tree rehash into the immutable receipt', () => {
  assert.match(source, /sealedTreeSha256/);
  assert.match(source, /sealed tree digest mismatch/);
  assert.match(source, /tree\.sha256/);
});

test('keeps manifest-derived file modes intact through final sealing and receipt publication', () => {
  assert.match(
    source,
    /"\$CHMOD" "\$\(\[\[ "\$mode" == 100755 \]\] && printf 0755 \|\| printf 0644\)" -- "\$file"/
  );
  assert.match(
    source,
    /secure_tree_directories\(\) \{\n  "\$FIND" "\$1" -type d -exec "\$CHMOD" 0700 -- \{\} \+\n\}/
  );
  assert.match(
    source,
    /\$CHOWN" -R root:root -- "\$tree"; secure_tree_directories "\$tree"\ntree_digest=\$\(sha "\$actual"\)/
  );
  assert.match(
    source,
    /"sealedTreeSha256":"%s".*"\$tree_digest".*\n"\$CHOWN" -R root:root -- "\$target" "\$receipt"; secure_tree_directories "\$target"; "\$CHMOD" 0700 -- "\$receipt"; "\$CHMOD" 0600 -- "\$receipt"\/\*/s
  );
  assert.doesNotMatch(source, /\$CHMOD" -R 0700 -- "\$tree"|\$CHMOD" -R 0700 -- "\$target"/);
});

test('keeps the preflight schema disjoint from final merge sealing', () => {
  assert.match(source, /preflight-v1/);
  assert.match(source, /final SHA mismatch/);
  assert.match(source, /scan SHA mismatch/);
});
