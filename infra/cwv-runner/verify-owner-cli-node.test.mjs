import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(
  new URL('./verify-owner-cli.sh', import.meta.url),
  'utf8'
);

test('defines a source-auth-free pre-bundle Node verification interface', () => {
  assert.match(source, /--prepare-task9-bootstrap-node/);
  const start = source.indexOf('prepare_task9_bootstrap_node()');
  const end = source.indexOf('\nparse_common()', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const preparation = source.slice(start, end);
  for (const fixedName of [
    'policy.json',
    'node.tar.xz',
    'node-shasums.txt',
    'node-shasums.sig',
    'node-keyring.kbx',
    'prepared-node/node',
    'prepared-node/node-provenance.json',
  ])
    assert.match(preparation, new RegExp(fixedName.replace('.', '\\.')));
  assert.match(preparation, /\/usr\/local\/bin\/gpgv --keyring/);
  assert.match(preparation, /node-v24\.18\.0-darwin-arm64\.tar\.xz/);
  assert.match(preparation, /\$1 == hash && \$2 == name \{count\+\+\}/);
  assert.match(preparation, /--reviewed-policy-sha256/);
  assert.doesNotMatch(
    preparation,
    /source[_-]authorization|authorized-source|\bgh\b|token|github\.com/
  );
});

test('fails closed when the fixed signature verifier is unavailable', () => {
  assert.match(source, /\[ -x \/usr\/local\/bin\/gpgv \] \|\| refuse/);
  assert.match(source, /gpgv_mode.*\(555\|755\)/);
});
