const stable = (value) =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, stable(value[key])])
        )
      : value;

const same = (left, right) =>
  JSON.stringify(stable(left)) === JSON.stringify(stable(right));
const absent = { absent: true };

function canFollow(previous, next) {
  if (
    next?.phase !== 'captured' ||
    previous?.sourceSha === next.sourceSha ||
    previous?.policyFileSha256 !== next.policyFileSha256
  )
    return false;
  const paths = Object.keys(next.files ?? {}).sort();
  if (!same(paths, Object.keys(next.prior ?? {}).sort())) return false;
  if (previous.phase === 'complete')
    return same(previous.receipt?.files, next.prior);
  if (previous.phase !== 'captured') return false;
  const previousPaths = Object.keys(previous.files ?? {}).sort();
  const previousPathSet = new Set(previousPaths);
  if (
    !same(previousPaths, Object.keys(previous.prior ?? {}).sort()) ||
    previousPaths.some((path) => !paths.includes(path))
  )
    return false;
  return paths.every(
    (path) =>
      (previousPathSet.has(path) &&
        (same(next.prior[path], previous.prior[path]) ||
          same(next.prior[path], previous.files[path]))) ||
      (!previousPathSet.has(path) && same(next.prior[path], absent))
  );
}

const isAuthorityRoot = (state) =>
  state.phase === 'complete' ||
  (state.phase === 'captured' &&
    Object.values(state.prior ?? {}).every((value) => value.absent === true));

const canPrecedeHistory = (previous, next) =>
  canFollow(
    previous,
    next?.phase === 'complete' ? { ...next, phase: 'captured' } : next
  );

function hasUniqueBoundHistory(states, baseline) {
  const count = (next, remaining) => {
    if (!remaining.length) return isAuthorityRoot(next) ? 1 : 0;
    let output = 0;
    for (const [index, previous] of remaining.entries()) {
      if (!canPrecedeHistory(previous, next)) continue;
      output += count(previous, remaining.toSpliced(index, 1));
      if (output > 1) return output;
    }
    return output;
  };
  return count(baseline, states) === 1;
}

export function resolveBootstrapReplacementChain(states, current) {
  if (!Array.isArray(states) || current?.phase !== 'captured')
    throw new TypeError('invalid bootstrap replacement authority chain');
  const walk = (next, visited) => {
    if (isAuthorityRoot(next)) return [[next]];
    const output = [];
    for (const previous of states) {
      if (
        previous === next ||
        visited.has(previous.sourceSha) ||
        !canFollow(previous, next)
      )
        continue;
      for (const chain of walk(
        previous,
        new Set([...visited, previous.sourceSha])
      ))
        output.push([...chain, next]);
    }
    return output;
  };
  const chains = walk(current, new Set([current.sourceSha])).filter((chain) =>
    hasUniqueBoundHistory(
      states.filter((state) => !chain.includes(state)),
      chain[0]
    )
  );
  if (chains.length !== 1)
    throw new TypeError('invalid bootstrap replacement authority chain');
  return chains[0];
}
