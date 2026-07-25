import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { canonicalJson } from './canonical-json.mjs';

const rowKeys = Object.freeze([
  'commandSha256',
  'depth',
  'parentStartTime',
  'pid',
  'ppid',
  'rootPid',
  'startTime',
]);

const compareNumber = (left, right) => left - right;

const compareRows = (left, right) =>
  compareNumber(left.depth, right.depth) ||
  compareNumber(left.rootPid, right.rootPid) ||
  compareNumber(left.pid, right.pid) ||
  compareNumber(left.startTime, right.startTime);

function assertInteger(value, name, minimum) {
  if (!Number.isSafeInteger(value) || value < minimum)
    throw new Error(`cron row ${name} is invalid`);
}

function assertRow(value) {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join('\0') !== rowKeys.join('\0')
  )
    throw new Error('cron row shape is invalid');
  assertInteger(value.pid, 'pid', 1);
  assertInteger(value.ppid, 'ppid', 0);
  assertInteger(value.startTime, 'startTime', 1);
  assertInteger(value.parentStartTime, 'parentStartTime', 0);
  assertInteger(value.rootPid, 'rootPid', 1);
  assertInteger(value.depth, 'depth', 0);
  if (!/^[a-f0-9]{64}$/.test(value.commandSha256))
    throw new Error('cron row command identity is invalid');
}

function validateTree(tree, globalPids) {
  if (!Array.isArray(tree) || tree.length === 0)
    throw new Error('cron tree is invalid');
  const rows = tree.map((value) => {
    assertRow(value);
    if (globalPids.has(value.pid)) throw new Error('duplicate cron pid');
    globalPids.add(value.pid);
    return { ...value };
  });
  const byPid = new Map(rows.map((value) => [value.pid, value]));
  const roots = rows.filter((value) => value.depth === 0);
  if (roots.length !== 1 || roots[0].rootPid !== roots[0].pid)
    throw new Error('cron root identity is invalid');
  const [root] = roots;
  if (byPid.has(root.ppid)) throw new Error('cron root parent forms a cycle');

  for (const value of rows) {
    if (value.rootPid !== root.pid)
      throw new Error('cron root membership is invalid');
    if (value === root) continue;
    const parent = byPid.get(value.ppid);
    if (!parent || parent.startTime !== value.parentStartTime)
      throw new Error('cron parent identity is invalid');
    if (value.depth !== parent.depth + 1)
      throw new Error('cron depth is invalid');
  }

  for (const value of rows) {
    const visited = new Set();
    let cursor = value;
    while (cursor !== root) {
      if (visited.has(cursor.pid)) throw new Error('cron cycle detected');
      visited.add(cursor.pid);
      cursor = byPid.get(cursor.ppid);
      if (!cursor) throw new Error('cron parent identity is invalid');
    }
  }
  return rows.sort(compareRows);
}

export function validateCronForest(forest) {
  if (!Array.isArray(forest)) throw new Error('cron forest is invalid');
  const globalPids = new Set();
  const validated = forest
    .map((tree) => validateTree(tree, globalPids))
    .sort((left, right) => compareNumber(left[0].rootPid, right[0].rootPid));
  if (validated.some(([root]) => globalPids.has(root.ppid)))
    throw new Error('cron root parent forms a cycle');
  return validated;
}

const sameRow = (left, right) =>
  rowKeys.every((key) => left[key] === right[key]);

export function mergeCronForests(initialForest, frozenForest) {
  const initial = validateCronForest(initialForest);
  const frozen = validateCronForest(frozenForest);
  const initialRows = initial.flat();
  const frozenByPid = new Map(frozen.flat().map((value) => [value.pid, value]));
  const initialRoots = new Set(initial.map(([root]) => root.pid));

  for (const value of initialRows) {
    const observed = frozenByPid.get(value.pid);
    if (!observed)
      throw new Error('captured cron process missing after freeze');
    if (!sameRow(value, observed))
      throw new Error('captured cron identity drift after freeze');
  }
  for (const [root] of frozen) {
    if (!initialRoots.has(root.pid)) throw new Error('unreviewed cron root');
  }
  return frozen;
}

export function orderCronForestDeepestFirst(forest) {
  return validateCronForest(forest)
    .flat()
    .sort(
      (left, right) =>
        compareNumber(right.depth, left.depth) ||
        compareNumber(left.rootPid, right.rootPid) ||
        compareNumber(left.pid, right.pid) ||
        compareNumber(left.startTime, right.startTime)
    );
}

function validateLiveObservations(observations) {
  if (!Array.isArray(observations))
    throw new Error('live cron observations are invalid');
  const byPid = new Map();
  for (const value of observations) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
      throw new Error('live cron process is invalid');
    if (
      !Number.isSafeInteger(value.pid) ||
      value.pid < 1 ||
      !Number.isSafeInteger(value.startTime) ||
      value.startTime < 1
    )
      throw new Error('live cron process is invalid');
    if (byPid.has(value.pid)) throw new Error('duplicate live cron pid');
    byPid.set(value.pid, value);
  }
  return byPid;
}

export function findCronSurvivors(forest, observations) {
  const liveByPid = validateLiveObservations(observations);
  return orderCronForestDeepestFirst(forest).filter((value) => {
    const live = liveByPid.get(value.pid);
    return live?.startTime === value.startTime;
  });
}

export function assertNoCronSurvivors(forest, observations) {
  const survivors = findCronSurvivors(forest, observations);
  if (survivors.length > 0)
    throw new Error(
      `new cron descendant survives: ${survivors.map(({ pid }) => pid).join(',')}`
    );
  return true;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function main([command, ...files]) {
  let result;
  if (command === 'merge' && files.length === 2) {
    result = mergeCronForests(
      await readJson(files[0]),
      await readJson(files[1])
    );
  } else if (command === 'order' && files.length === 1) {
    result = orderCronForestDeepestFirst(await readJson(files[0]));
  } else if (command === 'survivors' && files.length === 2) {
    const forest = await readJson(files[0]);
    const live = await readJson(files[1]);
    assertNoCronSurvivors(forest, live);
    result = [];
  } else {
    throw new Error('cron-tree command is invalid');
  }
  process.stdout.write(`${canonicalJson(result)}\n`);
}

if (fileURLToPath(import.meta.url) === process.argv[1])
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
