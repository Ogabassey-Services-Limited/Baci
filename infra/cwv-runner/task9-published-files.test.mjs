import assert from 'node:assert/strict';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { readPublishedTask9Files } from './task9-published-files.mjs';

const names = [
  'manifest.json',
  'manifest.sha256',
  'source.tar',
  'source.tar.sha256',
  'task9-bootstrap.mjs',
  'node',
  'node-provenance.json',
];

function payloadFixture() {
  const root = mkdtempSync(join(tmpdir(), 'task9-published-files-fixture-'));
  const payload = join(root, 'payload');
  mkdirSync(payload, { mode: 0o700 });
  for (const name of names) {
    writeFileSync(join(payload, name), name, {
      mode: name === 'node' ? 0o500 : 0o400,
    });
    chmodSync(join(payload, name), name === 'node' ? 0o500 : 0o400);
  }
  return { payload, root };
}

test('revalidates every held payload child before final authorization', () => {
  const root = mkdtempSync(join(tmpdir(), 'task9-published-files-'));
  const payload = join(root, 'payload');
  const owner = process.getuid();
  try {
    writeFileSync(join(root, '.placeholder'), '');
    mkdirSync(payload, { mode: 0o700 });
    for (const name of names) {
      writeFileSync(join(payload, name), name, {
        mode: name === 'node' ? 0o500 : 0o400,
      });
      chmodSync(join(payload, name), name === 'node' ? 0o500 : 0o400);
    }
    const held = readPublishedTask9Files(payload, owner, {
      afterRead() {
        const path = join(payload, 'node');
        renameSync(path, `${path}.reviewed`);
        writeFileSync(path, 'attacker', { mode: 0o500 });
      },
    });
    assert.throws(() => held.verify(), /published Task 9 payload changed/);
    held.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects an extra payload entry', () => {
  const value = payloadFixture();
  try {
    writeFileSync(join(value.payload, 'extra'), 'extra');
    assert.throws(
      () => readPublishedTask9Files(value.payload, process.getuid()),
      /published Task 9 payload changed/
    );
  } finally {
    rmSync(value.root, { recursive: true, force: true });
  }
});

test('rejects a missing payload entry', () => {
  const value = payloadFixture();
  try {
    rmSync(join(value.payload, 'node'));
    assert.throws(
      () => readPublishedTask9Files(value.payload, process.getuid()),
      /published Task 9 payload changed/
    );
  } finally {
    rmSync(value.root, { recursive: true, force: true });
  }
});

test('verifies an unchanged payload and closes its held descriptors', () => {
  const value = payloadFixture();
  const held = readPublishedTask9Files(value.payload, process.getuid());
  try {
    assert.doesNotThrow(() => held.verify());
  } finally {
    held.close();
    rmSync(value.root, { recursive: true, force: true });
  }
});

test('rejects a payload directory replacement with a symlink', () => {
  const value = payloadFixture();
  const moved = `${value.payload}.moved`;
  try {
    const held = readPublishedTask9Files(value.payload, process.getuid(), {
      afterRead() {
        renameSync(value.payload, moved);
        symlinkSync(moved, value.payload);
      },
    });
    assert.throws(() => held.verify(), /published Task 9 payload changed/);
    held.close();
  } finally {
    rmSync(value.root, { recursive: true, force: true });
    rmSync(moved, { recursive: true, force: true });
  }
});
