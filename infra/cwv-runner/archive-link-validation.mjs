const unsafeCharacter = (value) =>
  [...value].some(
    (character) =>
      character === '\\' ||
      character.charCodeAt(0) < 32 ||
      character.charCodeAt(0) === 127
  );

function normalizeLinkTarget(target, parent, rootRelative) {
  if (typeof target !== 'string' || !target || unsafeCharacter(target))
    throw new TypeError('unsafe tar link');
  const absolute = target.startsWith('/');
  if (absolute && target.startsWith('//'))
    throw new TypeError('unsafe tar link');
  const stack = absolute || rootRelative ? [] : parent ? parent.split('/') : [];
  for (const part of target.slice(absolute ? 1 : 0).split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!stack.length) throw new TypeError('tar link escapes root');
      stack.pop();
      continue;
    }
    stack.push(part);
  }
  if (!stack.length) throw new TypeError('unsafe tar link');
  return stack.join('/');
}

function parentPath(path) {
  const index = path.lastIndexOf('/');
  return index < 0 ? '' : path.slice(0, index);
}

export function validateArchiveLinks(records, projected = undefined) {
  const members = new Map();
  const resolved = new Map();
  for (const record of records) {
    if (members.has(record.name)) throw new TypeError('ambiguous tar member');
    members.set(record.name, record);
  }
  for (const record of records) {
    if (record.type !== '1' && record.type !== '2') continue;
    record.targetPath = normalizeLinkTarget(
      record.linkTarget,
      parentPath(record.name),
      record.type === '1'
    );
  }
  for (const record of records) {
    if (record.type !== '1' && record.type !== '2') continue;
    const path = [];
    const seen = new Set();
    let current = record;
    while (current.type === '1' || current.type === '2') {
      const cached = resolved.get(current.name);
      if (cached) {
        current = cached;
        break;
      }
      if (seen.has(current.name)) throw new TypeError('cyclic tar link');
      seen.add(current.name);
      path.push(current);
      current = members.get(current.targetPath);
      if (!current) throw new TypeError('dangling tar link');
    }
    for (const link of path) resolved.set(link.name, current);
    if (projected && !projected.has(current.name))
      throw new TypeError('unprojected tar link target');
    record.resolvedTarget = current.name;
  }
  return records;
}
