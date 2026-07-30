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
const SHA256 = /^[0-9a-f]{64}$/;
const SOURCE = /^[0-9a-f]{40}$/;

const isCompletedNoop = (state) =>
  state?.phase === 'complete' &&
  state.prior &&
  typeof state.prior === 'object' &&
  !Array.isArray(state.prior) &&
  state.files &&
  typeof state.files === 'object' &&
  !Array.isArray(state.files) &&
  same(state.prior, state.files) &&
  same(state.receipt?.files, state.files);

const isAuthenticatedCapturedNoop = (state) =>
  state?.phase === 'captured' &&
  SOURCE.test(state.sourceSha ?? '') &&
  SHA256.test(state.sourceManifestSha256 ?? '') &&
  SHA256.test(state.policyFileSha256 ?? '') &&
  SHA256.test(state.captureSha256 ?? '') &&
  state.prior &&
  typeof state.prior === 'object' &&
  !Array.isArray(state.prior) &&
  state.files &&
  typeof state.files === 'object' &&
  !Array.isArray(state.files) &&
  same(state.prior, state.files);

function canFollow(previous, next) {
  if (
    next?.phase !== 'captured' ||
    previous?.sourceSha === next.sourceSha ||
    previous?.policyFileSha256 !== next.policyFileSha256
  )
    return false;
  const paths = Object.keys(next.files ?? {}).sort();
  if (!same(paths, Object.keys(next.prior ?? {}).sort())) return false;
  if (previous.phase === 'complete') {
    const previousFiles = previous.receipt?.files;
    if (!previousFiles || typeof previousFiles !== 'object') return false;
    const previousPaths = Object.keys(previousFiles ?? {}).sort();
    const previousPathSet = new Set(previousPaths);
    if (previousPaths.some((path) => !paths.includes(path))) return false;
    return paths.every(
      (path) =>
        (previousPathSet.has(path) &&
          same(next.prior[path], previousFiles[path])) ||
        (!previousPathSet.has(path) && same(next.prior[path], absent))
    );
  }
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

const isBoundCapturedNoop = (state, chain) =>
  chain.some((previous, index) =>
    chain
      .slice(index + 1)
      .some((next) => canFollow(previous, state) && canFollow(state, next))
  );

const isBoundCompletedNoop = (state, chain) =>
  chain.some((previous, index) =>
    chain
      .slice(index + 1)
      .some(
        (next) =>
          canFollow(previous, { ...state, phase: 'captured' }) &&
          canFollow(state, next)
      )
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
  const completedNoops = states.filter(
    (state) => state !== current && isCompletedNoop(state)
  );
  const capturedNoops = states.filter(
    (state) => state !== current && isAuthenticatedCapturedNoop(state)
  );
  const effectiveStates = states.filter(
    (state) =>
      state === current ||
      (!isCompletedNoop(state) && !isAuthenticatedCapturedNoop(state))
  );
  const walk = (next, visited) => {
    if (isAuthorityRoot(next)) return [[next]];
    const output = [];
    for (const previous of effectiveStates) {
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
  const chains = walk(current, new Set([current.sourceSha])).filter(
    (chain) =>
      hasUniqueBoundHistory(
        effectiveStates.filter((state) => !chain.includes(state)),
        chain[0]
      ) &&
      completedNoops.every((state) => isBoundCompletedNoop(state, chain)) &&
      capturedNoops.every((state) => isBoundCapturedNoop(state, chain))
  );
  if (chains.length !== 1)
    throw new TypeError('invalid bootstrap replacement authority chain');
  return chains[0];
}
