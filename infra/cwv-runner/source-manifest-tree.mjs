import { verifyGitObjects } from './source-manifest-objects.mjs';

const fail = (message) => {
  throw new TypeError(message);
};

function checkedPath(path) {
  const parts = path.split('/');
  if (!path || path.includes('\0') || parts.some((part) => !part || part === '.' || part === '..')) fail('ambiguous Git tree path');
}

function treeId(commit) {
  const match = /^tree ([0-9a-f]{40,64})\n/m.exec(commit.toString('utf8'));
  if (!match) fail('malformed Git commit object');
  return match[1];
}

function walk(cwd, objectId, prefix, rows) {
  const object = verifyGitObjects(cwd, [objectId]).get(`${cwd}\0${objectId}`);
  if (!object || object.type !== 'tree') fail('malformed Git tree object');
  const width = objectId.length / 2;
  for (let offset = 0; offset < object.bytes.length; ) {
    const space = object.bytes.indexOf(0x20, offset);
    const nul = object.bytes.indexOf(0, space + 1);
    if (space < 0 || nul < 0 || nul + 1 + width > object.bytes.length) fail('malformed Git tree object');
    const mode = object.bytes.subarray(offset, space).toString('ascii');
    const name = object.bytes.subarray(space + 1, nul).toString('utf8');
    const path = prefix ? `${prefix}/${name}` : name;
    checkedPath(path);
    const childId = object.bytes.subarray(nul + 1, nul + 1 + width).toString('hex');
    if (mode === '40000') walk(cwd, childId, path, rows);
    else if (mode === '100644' || mode === '100755') {
      const child = verifyGitObjects(cwd, [childId]).get(`${cwd}\0${childId}`);
      if (!child || child.type !== 'blob') fail('malformed Git tree leaf');
      rows.push({ mode, objectId: childId, path });
    } else fail('unsupported Git tree mode');
    offset = nul + 1 + width;
  }
}

export function authenticatedTreeRows(cwd, sha) {
  const commit = verifyGitObjects(cwd, [sha]).get(`${cwd}\0${sha}`);
  if (!commit || commit.type !== 'commit') fail('source SHA must name a commit');
  const root = treeId(commit.bytes);
  const rows = [];
  walk(cwd, root, '', rows);
  return rows.sort((left, right) => Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)));
}
