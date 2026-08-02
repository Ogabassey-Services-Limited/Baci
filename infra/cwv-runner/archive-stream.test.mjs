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

import {
  archiveLimits,
  extractArchiveMember,
  inspectArchive,
  layerMemberBytes,
  listArchiveMembers,
  readSmallMember,
} from './archive-stream.mjs';
import { parseRunnerPolicy } from './policy.schema.mjs';

const policy = parseRunnerPolicy(
  JSON.parse(readFileSync(new URL('policy.json', import.meta.url)))
);
const octal = (value, width) =>
  `${value.toString(8).padStart(width - 1, '0')}\0`;
function tarHeader(name, size, type = '0') {
  const header = Buffer.alloc(512);
  header.write(name);
  header.write(octal(0o644, 8), 100);
  header.write(octal(size, 12), 124);
  header[156] = type.charCodeAt(0);
  header.fill(32, 148, 156);
  let checksum = 0;
  for (const value of header) checksum += value;
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'latin1');
  return header;
}
function archiveWith(...headers) {
  const directory = mkdtempSync(join(tmpdir(), 'cwv-archive-stream-'));
  const archive = join(directory, 'image.tar');
  writeFileSync(archive, Buffer.concat([...headers, Buffer.alloc(1024)]));
  return archive;
}

test('derives a bounded one-layer rootfs budget from the frozen artifact contract', () => {
  const cap = policy.supplyChainProvenance.artifactMaxBytes;
  assert.equal(
    archiveLimits.memberBytes,
    cap *
      (Object.keys(policy.supplyChain).length +
        Object.keys(policy.supplyChainProvenance).length -
        1)
  );
  assert.equal(
    archiveLimits.archiveBytes,
    archiveLimits.memberBytes + 4 * 1024 * 1024
  );
  assert.ok(archiveLimits.memberBytes > cap);
});

test('parses a permitted oversized rootfs member before rejecting its truncated payload', () => {
  const archive = archiveWith(
    tarHeader('rootfs', policy.supplyChainProvenance.artifactMaxBytes + 1)
  );
  assert.throws(
    () => inspectArchive(archive),
    /invalid or duplicate tar member/
  );
});

test('rejects an outer archive member-count bomb before extraction', () => {
  const archive = archiveWith(
    ...Array.from({ length: archiveLimits.members + 1 }, (_value, index) =>
      tarHeader(`member-${index}`, 0)
    )
  );
  assert.throws(() => inspectArchive(archive), /member count exceeds limit/);
});

test('accepts exactly the member limit before the tar terminator', () => {
  const archive = archiveWith(
    ...Array.from({ length: archiveLimits.members }, (_value, index) =>
      tarHeader(`member-${index}`, 0)
    )
  );
  assert.equal(inspectArchive(archive).length, archiveLimits.members);
});

test('counts ignored dot directories against the physical member limit', () => {
  const headers = Array.from({ length: archiveLimits.members }, () =>
    tarHeader('.', 0, '5')
  );
  assert.equal(inspectArchive(archiveWith(...headers)).length, 0);
  assert.throws(
    () => inspectArchive(archiveWith(...headers, tarHeader('.', 0, '5'))),
    /member count exceeds limit/
  );
});

test('retains the raw tar member name for later exact archive lookups', () => {
  const archive = archiveWith(tarHeader('./opt/baci-cwv/policy.json', 0));
  assert.deepEqual(listArchiveMembers(archive), ['./opt/baci-cwv/policy.json']);
});

test('applies a supplied archive byte limit while opening the archive', () => {
  const archive = archiveWith(tarHeader('member', 0));
  assert.throws(
    () =>
      inspectArchive(archive, {
        ...archiveLimits,
        archiveBytes: readFileSync(archive).length - 1,
      }),
    /archive size exceeds limit/
  );
});

test('stats and reads one open file descriptor across pathname substitution', () => {
  const directory = mkdtempSync(join(tmpdir(), 'cwv-small-member-'));
  const path = join(directory, 'member');
  const replacement = join(directory, 'replacement');
  writeFileSync(path, 'trusted');
  writeFileSync(replacement, 'substitute');
  let opens = 0;
  let closes = 0;
  const filesystem = {
    close(fd) {
      closes += 1;
      closeSync(fd);
    },
    open(target, flags) {
      opens += 1;
      const fd = openSync(target, flags);
      renameSync(replacement, target);
      return fd;
    },
  };
  assert.equal(readSmallMember(path, 64, filesystem).toString(), 'trusted');
  assert.equal(opens, 1);
  assert.equal(closes, 1);
});

test('rejects invalid checksums, nonzero padding, and hidden trailing bytes', () => {
  const badChecksum = archiveWith(tarHeader('member', 0));
  const checksumBytes = readFileSync(badChecksum);
  checksumBytes[0] ^= 1;
  writeFileSync(badChecksum, checksumBytes);
  assert.throws(() => inspectArchive(badChecksum), /header checksum/);

  const header = tarHeader('member', 1);
  const directory = mkdtempSync(join(tmpdir(), 'cwv-archive-stream-'));
  const badPadding = join(directory, 'bad-padding.tar');
  const payload = Buffer.alloc(512);
  payload[0] = 1;
  payload[1] = 1;
  writeFileSync(
    badPadding,
    Buffer.concat([header, payload, Buffer.alloc(1024)])
  );
  assert.throws(() => inspectArchive(badPadding), /member padding/);

  const trailing = archiveWith(tarHeader('member', 0));
  const trailingBytes = Buffer.concat([
    readFileSync(trailing),
    Buffer.alloc(512),
  ]);
  trailingBytes[trailingBytes.length - 1] = 1;
  writeFileSync(trailing, trailingBytes);
  assert.throws(() => inspectArchive(trailing), /after tar terminator/);
});

test('closes archive descriptors when destination open or copying fails', () => {
  const archive = archiveWith(tarHeader('member', 0));
  const workspace = mkdtempSync(join(tmpdir(), 'cwv-archive-output-'));
  const injected = (failure) => {
    const closed = [];
    let opens = 0;
    return {
      closed,
      filesystem: {
        close(fd) {
          closed.push(fd);
          closeSync(fd);
          if (failure === 'close' && closed.length === 1)
            throw new Error('injected close');
        },
        open(path, flags, mode) {
          opens += 1;
          if (failure === 'open' && opens === 2)
            throw new Error('injected open');
          return openSync(path, flags, mode);
        },
        write(fd, bytes) {
          if (failure === 'write') throw new Error('injected write');
          if (failure === 'short') return writeSync(fd, bytes.subarray(0, 1));
          return writeSync(fd, bytes);
        },
      },
    };
  };
  const openFailure = injected('open');
  assert.throws(
    () =>
      extractArchiveMember(
        archive,
        'member',
        workspace,
        'open-failure',
        openFailure.filesystem
      ),
    /injected open/
  );
  assert.equal(openFailure.closed.length, 1);

  const payloadArchive = archiveWith(
    tarHeader('member', 2),
    Buffer.concat([Buffer.from('xy'), Buffer.alloc(510)])
  );
  for (const [failure, message] of [
    ['write', /injected write/],
    ['short', /short archive member write/],
    ['close', /injected close/],
  ]) {
    const attempt = injected(failure);
    assert.throws(
      () =>
        extractArchiveMember(
          payloadArchive,
          'member',
          workspace,
          `${failure}-failure`,
          attempt.filesystem
        ),
      message
    );
    assert.equal(attempt.closed.length, 2);
  }
});

test('refuses archive pathname substitution between inspection and copy', () => {
  const trusted = archiveWith(
    tarHeader('member', 4),
    Buffer.concat([Buffer.from('safe'), Buffer.alloc(508)])
  );
  const substitute = archiveWith(
    tarHeader('other', 4),
    Buffer.concat([Buffer.from('evil'), Buffer.alloc(508)])
  );
  const workspace = mkdtempSync(join(tmpdir(), 'cwv-archive-output-'));
  const filesystem = {
    close: closeSync,
    open(path, flags, mode) {
      if (path === trusted && flags === 'r') renameSync(substitute, trusted);
      return openSync(path, flags, mode);
    },
    write: writeSync,
  };
  assert.throws(
    () =>
      extractArchiveMember(
        trusted,
        'member',
        workspace,
        'substitution',
        filesystem
      ),
    /missing regular archive member/
  );
});

test('reports a missing in-memory layer member with a domain error', () => {
  assert.throws(
    () => layerMemberBytes(Buffer.alloc(0), undefined),
    /missing layer member/
  );
});
