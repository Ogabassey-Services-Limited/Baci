// biome-ignore-all format: sealed authority bytes are mirrored into the runtime image.

const fail = (message) => {
  throw new Error(message);
};

export function parsePathFilters(text) {
  if (typeof text !== 'string') fail('deploy filter refused');
  const filters = {};
  let current;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (line.trim() === '' || line.trim().startsWith('#')) continue;
    const section = /^(?<name>[A-Za-z_][A-Za-z0-9_-]*):$/.exec(line);
    if (section) {
      if (Object.hasOwn(filters, section.groups.name)) fail('deploy filter refused');
      current = section.groups.name;
      filters[current] = [];
      continue;
    }
    const path = /^ {2}- '(?<value>[^']+)'$/.exec(line);
    if (!path || !current) fail('deploy filter refused');
    filters[current].push(path.groups.value);
  }
  return filters;
}

export function activeDeployFilterReferences(text) {
  if (typeof text !== 'string') fail('deploy filter refused');
  const references = [];
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const uses = /^(?<indent> *)- uses: dorny\/paths-filter@/.exec(lines[index]);
    if (!uses) continue;
    const baseIndent = uses.groups.indent.length;
    for (let nested = index + 1; nested < lines.length; nested += 1) {
      const line = lines[nested];
      if (line.trim() === '' || line.trim().startsWith('#')) continue;
      const indent = line.search(/\S/);
      if (indent <= baseIndent) break;
      const filter = /^ *filters: (?<path>[^\s#]+)$/.exec(line);
      if (filter) references.push(filter.groups.path);
    }
  }
  return references;
}

export function assertDeployFilterContract(deploy, deployFilter) {
  const deployFilterReferences = activeDeployFilterReferences(deploy);
  const deployFilters = parsePathFilters(deployFilter);
  const runnerPath = 'infra/cwv-runner/**';
  if (
    deployFilterReferences.length !== 1 ||
    deployFilterReferences[0] !== '.github/filters/deploy.yml'
  )
    fail('deploy filter refused');
  for (const name of ['web', 'cwv_runner']) {
    if ((deployFilters[name] ?? []).filter((path) => path === runnerPath).length !== 1)
      fail('deploy filter refused');
  }
  if (
    Object.entries(deployFilters).some(
      ([name, paths]) => !['web', 'cwv_runner'].includes(name) && paths.includes(runnerPath),
    )
  )
    fail('deploy filter refused');
}
