import { git } from './source-manifest-git.mjs';
import { verifyGitObjects } from './source-manifest-objects.mjs';

const fail = (message) => {
  throw new TypeError(message);
};

function checkedPath(path) {
  const parts = path.split('/');
  if (
    !path ||
    path.includes('\0') ||
    parts.some((part) => !part || part === '.' || part === '..')
  )
    fail('ambiguous Git tree path');
}

function treeId(commit) {
  const match = /^tree ([0-9a-f]{40,64})\n/.exec(commit.toString('utf8'));
  if (!match) fail('malformed Git commit object');
  return match[1];
}

function listedTree(cwd, sha) {
  const output = git(cwd, ['ls-tree', '-r', '-t', '-z', sha], null, null);
  const ids = [sha];
  const leaves = [];
  const trees = [];
  for (const record of output.toString('binary').split('\0').filter(Boolean)) {
    const bytes = Buffer.from(record, 'binary');
    const tab = bytes.indexOf(0x09);
    if (tab < 0) fail('malformed Git tree row');
    const match = /^(\d{6}) (blob|tree) ([0-9a-f]{40,64})$/.exec(
      bytes.subarray(0, tab).toString('ascii')
    );
    if (!match) fail('malformed Git tree row');
    const [, mode, type, objectId] = match;
    const nameBytes = bytes.subarray(tab + 1);
    const path = nameBytes.toString('utf8');
    if (!Buffer.from(path).equals(nameBytes)) fail('non-UTF-8 Git tree name');
    checkedPath(path);
    ids.push(objectId);
    if (type === 'blob') {
      if (mode !== '100644' && mode !== '100755')
        fail('unsupported Git tree mode');
      leaves.push({ mode, objectId, path });
    } else {
      if (mode !== '040000') fail('unsupported Git tree mode');
      trees.push({ mode: '40000', objectId, path });
    }
  }
  return { ids, leaves, trees };
}

function walk(cwd, objects, objectId, prefix, leaves, trees) {
  const object = objects.get(`${cwd}\0${objectId}`);
  if (object?.type !== 'tree') fail('malformed Git tree object');
  const width = objectId.length / 2;
  for (let offset = 0; offset < object.bytes.length; ) {
    const space = object.bytes.indexOf(0x20, offset);
    const nul = object.bytes.indexOf(0, space + 1);
    if (space < 0 || nul < 0 || nul + 1 + width > object.bytes.length)
      fail('malformed Git tree object');
    const mode = object.bytes.subarray(offset, space).toString('ascii');
    const nameBytes = object.bytes.subarray(space + 1, nul);
    const name = nameBytes.toString('utf8');
    if (!Buffer.from(name).equals(nameBytes)) fail('non-UTF-8 Git tree name');
    const path = prefix ? `${prefix}/${name}` : name;
    checkedPath(path);
    const childId = object.bytes
      .subarray(nul + 1, nul + 1 + width)
      .toString('hex');
    const child = objects.get(`${cwd}\0${childId}`);
    if (!child) fail('malformed Git tree leaf');
    if (mode === '40000') {
      if (child.type !== 'tree') fail('malformed Git tree object');
      trees.push({ mode, objectId: childId, path });
      walk(cwd, objects, childId, path, leaves, trees);
    } else if (mode === '100644' || mode === '100755') {
      if (child.type !== 'blob') fail('malformed Git tree leaf');
      leaves.push({ mode, objectId: childId, path });
    } else fail('unsupported Git tree mode');
    offset = nul + 1 + width;
  }
}

function compareRows(listed, authenticated, label) {
  const sort = (rows) =>
    rows
      .slice()
      .sort((left, right) =>
        Buffer.compare(Buffer.from(left.path), Buffer.from(right.path))
      );
  const expected = sort(listed);
  const actual = sort(authenticated);
  if (
    expected.length !== actual.length ||
    expected.some(
      (row, index) =>
        row.path !== actual[index].path ||
        row.mode !== actual[index].mode ||
        row.objectId !== actual[index].objectId
    )
  )
    fail(`${label} differs from authenticated tree`);
}

export function authenticatedTreeRows(cwd, sha) {
  const commit = verifyGitObjects(cwd, [sha]).get(`${cwd}\0${sha}`);
  if (commit?.type !== 'commit') fail('source SHA must name a commit');
  const root = treeId(commit.bytes);
  const listed = listedTree(cwd, sha);
  const objects = verifyGitObjects(cwd, [root, ...listed.ids]);
  const leaves = [];
  const trees = [];
  walk(cwd, objects, root, '', leaves, trees);
  compareRows(listed.leaves, leaves, 'Git leaf rows');
  compareRows(listed.trees, trees, 'Git tree rows');
  if (new Set(leaves.map(({ path }) => path)).size !== leaves.length)
    fail('duplicate Git tree path');
  return leaves.sort((left, right) =>
    Buffer.compare(Buffer.from(left.path), Buffer.from(right.path))
  );
}
