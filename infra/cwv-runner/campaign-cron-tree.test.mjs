import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const exec = promisify(execFile);

let contract;
try {
  contract = await import('./campaign-cron-tree.mjs');
} catch {
  contract = undefined;
}

const sha = (value) => value.repeat(64);
const row = (overrides = {}) => ({
  pid: 10,
  ppid: 1,
  startTime: 100,
  parentStartTime: 1,
  commandSha256: sha('a'),
  rootPid: 10,
  depth: 0,
  ...overrides,
});
const root = row();
const child = row({
  pid: 11,
  ppid: 10,
  startTime: 110,
  parentStartTime: 100,
  commandSha256: sha('b'),
  depth: 1,
});
const sibling = row({
  pid: 12,
  ppid: 10,
  startTime: 120,
  parentStartTime: 100,
  commandSha256: sha('c'),
  depth: 1,
});
const grandchild = row({
  pid: 13,
  ppid: 11,
  startTime: 130,
  parentStartTime: 110,
  commandSha256: sha('d'),
  depth: 2,
});

const requireContract = () => {
  assert.ok(contract, 'campaign cron-tree contract must exist');
  return contract;
};

test('accepts an empty forest and preserves root and depth identity', () => {
  const { validateCronForest } = requireContract();

  assert.deepEqual(validateCronForest([]), []);
  assert.deepEqual(validateCronForest([[child, root]]), [[root, child]]);
});

test('rejects malformed rows, duplicate processes, and invalid root identity', () => {
  const { validateCronForest } = requireContract();

  assert.throws(() => validateCronForest({}), /cron forest/);
  assert.throws(() => validateCronForest([[]]), /cron tree/);
  assert.throws(
    () => validateCronForest([[{ ...root, rootPid: undefined }]]),
    /cron row/
  );
  assert.throws(
    () => validateCronForest([[root, { ...child, pid: root.pid }]]),
    /duplicate cron pid/
  );
  assert.throws(
    () => validateCronForest([[{ ...root, rootPid: 999 }]]),
    /cron root identity/
  );
  assert.throws(
    () =>
      validateCronForest([
        [root, { ...sibling, depth: 0, rootPid: sibling.pid }],
      ]),
    /cron root identity/
  );
  assert.throws(
    () => validateCronForest([[{ ...root, ppid: child.pid }, child]]),
    /cron root parent|cron cycle/
  );
  const otherRoot = row({ pid: 20, rootPid: 20, startTime: 200 });
  assert.throws(
    () =>
      validateCronForest([
        [
          {
            ...root,
            ppid: otherRoot.pid,
            parentStartTime: otherRoot.startTime,
          },
        ],
        [otherRoot],
      ]),
    /cron root parent|cron cycle/
  );
});

test('rejects broken parent identity, depth, root membership, and cycles', () => {
  const { validateCronForest } = requireContract();

  assert.throws(
    () =>
      validateCronForest([
        [root, { ...child, parentStartTime: root.startTime + 1 }],
      ]),
    /cron parent identity/
  );
  assert.throws(
    () => validateCronForest([[root, { ...child, depth: 2 }]]),
    /cron depth/
  );
  assert.throws(
    () => validateCronForest([[root, { ...child, rootPid: 99 }]]),
    /cron root membership/
  );
  assert.throws(
    () =>
      validateCronForest([
        [
          root,
          {
            ...child,
            ppid: grandchild.pid,
            parentStartTime: grandchild.startTime,
          },
          { ...grandchild, ppid: child.pid, parentStartTime: child.startTime },
        ],
      ]),
    /cron cycle|cron depth/
  );
});

test('merges the frozen observation with new descendants only', () => {
  const { mergeCronForests } = requireContract();
  const initial = [[root, child]];
  const frozen = [[grandchild, sibling, child, root]];

  assert.deepEqual(mergeCronForests(initial, frozen), [
    [root, child, sibling, grandchild],
  ]);
  assert.throws(
    () => mergeCronForests(initial, [[root, sibling]]),
    /captured cron process missing/
  );
  assert.throws(
    () =>
      mergeCronForests(initial, [
        [root, { ...child, commandSha256: sha('e') }],
      ]),
    /captured cron identity drift/
  );
  assert.throws(
    () =>
      mergeCronForests(initial, [
        [root, child],
        [row({ pid: 20, rootPid: 20 })],
      ]),
    /unreviewed cron root/
  );
});

test('orders the frozen forest deepest-first with deterministic ties', () => {
  const { orderCronForestDeepestFirst } = requireContract();

  assert.deepEqual(
    orderCronForestDeepestFirst([[sibling, grandchild, root, child]]).map(
      ({ pid }) => pid
    ),
    [grandchild.pid, child.pid, sibling.pid, root.pid]
  );
});

test('detects survivors by start identity and excludes reused PIDs', () => {
  const { assertNoCronSurvivors, findCronSurvivors } = requireContract();
  const forest = [[root, child, grandchild]];
  const observations = [
    { pid: root.pid, startTime: root.startTime + 1 },
    { pid: child.pid, startTime: child.startTime },
    { pid: 999, startTime: 1 },
  ];

  assert.deepEqual(
    findCronSurvivors(forest, observations).map(({ pid }) => pid),
    [child.pid]
  );
  assert.throws(
    () => assertNoCronSurvivors(forest, observations),
    /new cron descendant survives.*11/
  );
  assert.equal(
    assertNoCronSurvivors(forest, [
      { pid: root.pid, startTime: root.startTime + 1 },
    ]),
    true
  );
});

test('rejects duplicate and malformed live observations', () => {
  const { findCronSurvivors } = requireContract();

  assert.throws(
    () =>
      findCronSurvivors(
        [[root]],
        [
          { pid: root.pid, startTime: root.startTime },
          { pid: root.pid, startTime: root.startTime + 1 },
        ]
      ),
    /duplicate live cron pid/
  );
  assert.throws(
    () => findCronSurvivors([[root]], [{ pid: 0, startTime: 1 }]),
    /live cron process/
  );
});

test('provides deterministic merge, order, and fail-closed survivor commands', async () => {
  requireContract();
  const directory = await mkdtemp(path.join(os.tmpdir(), 'cron-tree-'));
  const files = {
    initial: path.join(directory, 'initial.json'),
    frozen: path.join(directory, 'frozen.json'),
    live: path.join(directory, 'live.json'),
  };
  await Promise.all([
    writeFile(files.initial, JSON.stringify([[root, child]])),
    writeFile(files.frozen, JSON.stringify([[root, child, grandchild]])),
    writeFile(
      files.live,
      JSON.stringify([{ pid: root.pid, startTime: root.startTime + 1 }])
    ),
  ]);
  const script = new URL('./campaign-cron-tree.mjs', import.meta.url);

  const merged = await exec(process.execPath, [
    script.pathname,
    'merge',
    files.initial,
    files.frozen,
  ]);
  const ordered = await exec(process.execPath, [
    script.pathname,
    'order',
    files.frozen,
  ]);
  const stopped = await exec(process.execPath, [
    script.pathname,
    'survivors',
    files.frozen,
    files.live,
  ]);

  assert.deepEqual(JSON.parse(merged.stdout), [[root, child, grandchild]]);
  assert.deepEqual(
    JSON.parse(ordered.stdout).map(({ pid }) => pid),
    [grandchild.pid, child.pid, root.pid]
  );
  assert.deepEqual(JSON.parse(stopped.stdout), []);

  await writeFile(
    files.live,
    JSON.stringify([{ pid: child.pid, startTime: child.startTime }])
  );
  await assert.rejects(
    () =>
      exec(process.execPath, [
        script.pathname,
        'survivors',
        files.frozen,
        files.live,
      ]),
    /new cron descendant survives.*11/
  );
});
