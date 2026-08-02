import assert from 'node:assert/strict';
import {
  closeSync,
  mkdtempSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createArchiveIndex } from './archive-index.mjs';
import { archiveLimits, openArchiveIndex } from './archive-stream.mjs';

const octal = (value, width) =>
  `${value.toString(8).padStart(width - 1, '0')}\0`;
function tarHeader(name, size = 0) {
  const header = Buffer.alloc(512);
  header.write(name);
  header.write(octal(0o644, 8), 100);
  header.write(octal(size, 12), 124);
  header[156] = '0'.charCodeAt(0);
  header.fill(32, 148, 156);
  const checksum = header.reduce((sum, value) => sum + value, 0);
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'latin1');
  return header;
}
function archiveWith(...names) {
  const directory = mkdtempSync(join(tmpdir(), 'cwv-archive-index-'));
  const archive = join(directory, 'layer.tar');
  writeFileSync(
    archive,
    Buffer.concat([...names.map((name) => tarHeader(name)), Buffer.alloc(1024)])
  );
  return archive;
}
function payloadArchive(name, contents) {
  const archive = archiveWith();
  const payload = Buffer.alloc(512);
  payload.write(contents);
  writeFileSync(
    archive,
    Buffer.concat([
      tarHeader(name, contents.length),
      payload,
      Buffer.alloc(1024),
    ])
  );
  return archive;
}

test('indexes 1000+ members once with bounded direct lookup work', () => {
  const count = 1001;
  const archive = archiveWith(
    ...Array.from({ length: count }, (_value, index) =>
      index % 2 ? `./member-${index}` : `member-${index}`
    )
  );
  const workspace = mkdtempSync(join(tmpdir(), 'cwv-index-output-'));
  let archiveOpens = 0;
  const filesystem = {
    close: closeSync,
    open(path, flags, mode) {
      if (path === archive) archiveOpens += 1;
      return openSync(path, flags, mode);
    },
    write: writeSync,
  };
  const index = openArchiveIndex(
    archive,
    archiveLimits,
    archiveLimits.layerMembers,
    filesystem
  );
  try {
    for (let member = 0; member < count; member += 1)
      assert.match(index.details(`member-${member}`), /-644 0\/0 0 member-/);
    const extracted = index.extract('member-1000', workspace, 'member');
    assert.equal(readFileSync(extracted).length, 0);
    assert.deepEqual(index.stats, {
      indexedMembers: count,
      indexedNames: count + Math.floor(count / 2),
      lookups: count + 1,
      parses: 1,
    });
    assert.equal(archiveOpens, 1);
  } finally {
    index.close();
  }
});

test('extracts from the validated descriptor after pathname substitution', () => {
  const trusted = payloadArchive('member', 'safe');
  const replacement = payloadArchive('member', 'evil');
  const workspace = mkdtempSync(join(tmpdir(), 'cwv-index-output-'));
  const index = openArchiveIndex(trusted);
  renameSync(replacement, trusted);
  try {
    assert.equal(
      readFileSync(index.extract('member', workspace, 'member')).toString(),
      'safe'
    );
    assert.equal(index.stats.parses, 1);
  } finally {
    index.close();
  }
});

test('rejects duplicate normalized or raw archive member names', () => {
  const member = { gid: 0, mode: 0o644, size: 0, type: '0', uid: 0 };
  assert.throws(
    () =>
      createArchiveIndex(
        [
          { ...member, name: 'member', rawName: './member' },
          { ...member, name: './member', rawName: '././member' },
        ],
        { close: () => undefined, extract: () => undefined },
        { parses: 1 }
      ),
    /duplicate archive member/
  );
});
