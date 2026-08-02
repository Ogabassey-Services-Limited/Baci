import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { canonicalJson } from './canonical-json.mjs';
import { readPostEgressRelease } from './registration-post-egress-recovery.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const campaignId = 'registration-01';
const imageDigest = `sha256:${'d'.repeat(64)}`;
const registrationNonce = 'b'.repeat(32);
const container = Object.freeze({
  containerId: 'a'.repeat(64),
  imageDigest,
  name: `baci-cwv-registration-${registrationNonce}`,
  schemaVersion: 1,
  transactionId: campaignId,
});
const capture = Buffer.from(
  `${canonicalJson({
    mode: 'registration',
    schemaVersion: 1,
    transactionId: campaignId,
  })}\n`
);
const captureSha256 = digest(capture);
const details = (type, mode, size, overrides = {}) => ({
  dev: 7,
  gid: 0,
  ino: overrides.ino ?? 8,
  isDirectory: () => type === 'directory',
  isFile: () => type === 'file',
  isSymbolicLink: () => type === 'link',
  mode,
  nlink: overrides.nlink ?? 1,
  size,
  uid: 0,
  ...overrides,
});
function journal(sequence, previousSha256, action, resource) {
  const entry = {
    action,
    captureSha256,
    mode: 'registration',
    previousSha256,
    resource,
    resourceIdentitySha256: digest(canonicalJson(resource)),
    schemaVersion: 1,
    sequence,
    transactionId: campaignId,
  };
  const body = Buffer.from(`${canonicalJson(entry)}\n`);
  return { body, digest: digest(body) };
}
function fixture(options = {}) {
  const created = journal(1, null, 'registration-container-created', container);
  const release = journal(2, created.digest, 'registration-egress-released', {
    activeEgressRuleSha256: 'e'.repeat(64),
    schemaVersion: 1,
  });
  const root = '/campaigns';
  const transaction = `${root}/${campaignId}`;
  const directory = `${transaction}/journal`;
  const files = new Map([
    [`${transaction}/capture.json`, capture],
    [`${transaction}/capture.sha256`, Buffer.from(`${captureSha256}\n`)],
    [`${directory}/000001-${created.digest}.json`, created.body],
    [`${directory}/000002-${release.digest}.json`, release.body],
  ]);
  for (const [name, body] of Object.entries(options.files ?? {}))
    files.set(name, Buffer.isBuffer(body) ? body : Buffer.from(body));
  if (options.remove) files.delete(options.remove);
  const dirs = new Set([root, transaction, directory]);
  const lstat = (name) => {
    if (dirs.has(name))
      return details('directory', 0o40700, 0, { ino: name.length });
    const body = files.get(name);
    if (!body) {
      const error = new Error('missing');
      error.code = 'ENOENT';
      throw error;
    }
    return (
      options.stat?.(name, body) ??
      details('file', 0o100600, body.length, { ino: name.length })
    );
  };
  const open = async (name) => {
    const before = await lstat(name);
    const body = files.get(name);
    return {
      close: async () => undefined,
      readFile: async () => body,
      stat: async () => options.after?.(name, before) ?? before,
      sync: async () => undefined,
    };
  };
  return {
    deps: {
      assertRoot: () => undefined,
      campaignRoot: root,
      lstat,
      open,
      readdir: async (name) =>
        [...files.keys()]
          .filter((file) => file.startsWith(`${name}/`))
          .map((file) => file.slice(name.length + 1)),
    },
    files,
    release,
    created,
  };
}
const read = (dependencies) =>
  readPostEgressRelease(
    { campaignId, imageDigest, registrationNonce },
    dependencies
  );

test('returns immutable release evidence after the durable release-before-cleanup crash window', async () => {
  const value = fixture();
  assert.deepEqual(await read(value.deps), {
    activeEgressRuleSha256: 'e'.repeat(64),
    campaignId,
    captureSha256,
    containerId: container.containerId,
    egressReleaseSha256: value.release.digest,
    imageDigest,
    name: container.name,
    schemaVersion: 1,
  });
});

test('returns undefined before egress and refuses extra journal state', async () => {
  const value = fixture();
  value.files.delete(
    `/campaigns/${campaignId}/journal/000002-${value.release.digest}.json`
  );
  assert.equal(await read(value.deps), undefined);
  value.files.set(
    `/campaigns/${campaignId}/journal/notes.txt`,
    Buffer.from('unexpected')
  );
  await assert.rejects(read(value.deps), /post-egress recovery refused/);
});

test('fails closed on malformed, reordered, duplicate, conflicting, or rollback journal state', async () => {
  const cases = [
    () =>
      fixture({
        files: {
          [`/campaigns/${campaignId}/journal/000002-${'f'.repeat(64)}.json`]:
            Buffer.from('{}'),
        },
      }),
    () =>
      fixture({
        files: {
          [`/campaigns/${campaignId}/journal/000001-${'f'.repeat(64)}.json`]:
            Buffer.from('{}'),
        },
      }),
    () => {
      const value = fixture();
      const duplicate = journal(
        3,
        value.release.digest,
        'registration-egress-released',
        {
          activeEgressRuleSha256: 'e'.repeat(64),
          schemaVersion: 1,
        }
      );
      value.files.set(
        `/campaigns/${campaignId}/journal/000003-${duplicate.digest}.json`,
        duplicate.body
      );
      return value;
    },
    () => {
      const value = fixture();
      const rollback = journal(
        3,
        value.release.digest,
        'registration-egress-restored',
        {}
      );
      value.files.set(
        `/campaigns/${campaignId}/journal/000003-${rollback.digest}.json`,
        rollback.body
      );
      return value;
    },
    () => {
      const value = fixture();
      const removed = journal(
        3,
        value.release.digest,
        'registration-container-removed',
        { containerId: container.containerId, schemaVersion: 1 }
      );
      value.files.set(
        `/campaigns/${campaignId}/journal/000003-${removed.digest}.json`,
        removed.body
      );
      return value;
    },
  ];
  for (const make of cases)
    await assert.rejects(read(make().deps), /post-egress recovery refused/);
});

test('rejects an otherwise valid hash-chained row with an extra field', async () => {
  const value = fixture();
  const altered = {
    action: 'registration-egress-released',
    captureSha256,
    extra: true,
    mode: 'registration',
    previousSha256: value.created.digest,
    resource: { activeEgressRuleSha256: 'e'.repeat(64), schemaVersion: 1 },
    resourceIdentitySha256: digest(
      canonicalJson({
        activeEgressRuleSha256: 'e'.repeat(64),
        schemaVersion: 1,
      })
    ),
    schemaVersion: 1,
    sequence: 2,
    transactionId: campaignId,
  };
  const body = Buffer.from(`${canonicalJson(altered)}\n`);
  value.files.delete(
    `/campaigns/${campaignId}/journal/000002-${value.release.digest}.json`
  );
  value.files.set(
    `/campaigns/${campaignId}/journal/000002-${digest(body)}.json`,
    body
  );
  await assert.rejects(read(value.deps), /post-egress recovery refused/);
});

test('requires the exact preceding container, capture digest, campaign, image, and nonce bindings', async () => {
  const noContainer = fixture();
  noContainer.files.delete(
    `/campaigns/${campaignId}/journal/000001-${noContainer.created.digest}.json`
  );
  await assert.rejects(read(noContainer.deps), /post-egress recovery refused/);
  const captureDrift = fixture();
  captureDrift.files.set(
    `/campaigns/${campaignId}/capture.sha256`,
    Buffer.from(`${'0'.repeat(64)}\n`)
  );
  await assert.rejects(read(captureDrift.deps), /post-egress recovery refused/);
  for (const input of [
    { campaignId: 'other', imageDigest, registrationNonce },
    { campaignId, imageDigest: `sha256:${'0'.repeat(64)}`, registrationNonce },
    { campaignId, imageDigest, registrationNonce: '0'.repeat(32) },
  ])
    await assert.rejects(
      readPostEgressRelease(input, fixture().deps),
      /post-egress recovery refused/
    );
});

test('rejects unsafe ownership, links, symlinks, and inode drift in sealed state', async () => {
  for (const stat of [
    (_name, body) => details('file', 0o100600, body.length, { gid: 1 }),
    (_name, body) => details('file', 0o100640, body.length),
    (_name, body) => details('file', 0o100600, body.length, { nlink: 2 }),
    (_name, body) => details('link', 0o120600, body.length),
  ])
    await assert.rejects(
      read(fixture({ stat }).deps),
      /post-egress recovery refused/
    );
  await assert.rejects(
    read(
      fixture({
        after: (_name, before) => ({ ...before, ino: before.ino + 1 }),
      }).deps
    ),
    /post-egress recovery refused/
  );
});
