const memberDetails = (member) =>
  `${member.type === '0' ? '-' : member.type === '5' ? 'd' : member.type === '2' ? 'l' : 'h'}${member.mode.toString(8)} ${member.uid}/${member.gid} ${member.size} ${member.name}`;

export function createArchiveIndex(members, operations, instrumentation) {
  const boundedMembers = Object.freeze(
    members.map((member) => Object.freeze(member))
  );
  const byName = new Map();
  for (const member of boundedMembers) {
    if (byName.has(member.name) || byName.has(member.rawName))
      throw new TypeError('duplicate archive member name');
    byName.set(member.name, member);
    byName.set(member.rawName, member);
  }
  let closed = false;
  let lookups = 0;
  const find = (name) => {
    if (closed) throw new TypeError('archive index closed');
    lookups += 1;
    return byName.get(name);
  };
  const stats = Object.freeze({
    get indexedMembers() {
      return boundedMembers.length;
    },
    get indexedNames() {
      return byName.size;
    },
    get lookups() {
      return lookups;
    },
    get parses() {
      return instrumentation.parses;
    },
  });
  return Object.freeze({
    close() {
      if (closed) return;
      closed = true;
      operations.close();
    },
    details(name) {
      const member = find(name);
      if (!member) throw new TypeError('missing archive member');
      return memberDetails(member);
    },
    extract(name, workspace, output) {
      const member = find(name);
      if (member?.type !== '0')
        throw new TypeError('missing regular archive member');
      return operations.extract(member, workspace, output);
    },
    find,
    members: boundedMembers,
    stats,
  });
}
