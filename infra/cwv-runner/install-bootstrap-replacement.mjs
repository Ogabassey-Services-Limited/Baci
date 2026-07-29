import { createHash } from 'node:crypto';

const HEX = /^[0-9a-f]{64}$/;
const SOURCE = /^[0-9a-f]{40}$/;
const downstreamKeys = [
  'acceptedImageFiles',
  'activeDedicatedUnits',
  'prepareTransactions',
  'registrationArtifacts',
  'runnerConfigurationFiles',
  'unsafeUnitStates',
  'watchdogInstances',
];

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
const digest = (value) =>
  createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex');
const exactKeys = (value, keys) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  same(Object.keys(value).sort(), [...keys].sort());

export function planBootstrapReplacement({
  authorityChain,
  nextState,
  installedProjection,
  downstreamState,
}) {
  if (
    !Array.isArray(authorityChain) ||
    authorityChain.length < 2 ||
    authorityChain.at(-1) !== nextState ||
    authorityChain
      .slice(0, -1)
      .some((state, index) => !canFollow(state, authorityChain[index + 1]))
  )
    throw new TypeError('invalid bootstrap replacement authority chain');
  const baselineState = authorityChain[0];
  const pristine =
    baselineState?.phase === 'captured' &&
    Object.values(baselineState.prior ?? {}).every(
      (value) => value.absent === true
    );
  if (
    nextState?.phase !== 'captured' ||
    (!pristine && baselineState?.phase !== 'complete') ||
    !SOURCE.test(baselineState.sourceSha ?? '') ||
    !SOURCE.test(nextState.sourceSha ?? '') ||
    baselineState.sourceSha === nextState.sourceSha ||
    !HEX.test(
      pristine
        ? (baselineState.captureSha256 ?? '')
        : (baselineState.receiptSha256 ?? '')
    ) ||
    !HEX.test(nextState.captureSha256 ?? '')
  )
    throw new TypeError('bounded bootstrap replacement chain required');
  if (
    (!pristine &&
      (baselineState.receipt?.sourceSha !== baselineState.sourceSha ||
        baselineState.receipt?.sourceManifestSha256 !==
          baselineState.sourceManifestSha256 ||
        baselineState.receipt?.policyFileSha256 !==
          baselineState.policyFileSha256)) ||
    baselineState.policyFileSha256 !== nextState.policyFileSha256
  )
    throw new TypeError('bootstrap replacement authority mismatch');
  if (
    !exactKeys(downstreamState, downstreamKeys) ||
    downstreamKeys.some(
      (key) =>
        !Number.isSafeInteger(downstreamState[key]) ||
        downstreamState[key] !== 0
    )
  )
    throw new TypeError('downstream provisioning exists');
  if (!exactKeys(installedProjection, Object.keys(nextState.files)))
    throw new TypeError('installed bootstrap path set drift');
  const replace = [];
  const alreadyCurrent = [];
  const transitionPaths = [];
  for (const path of Object.keys(nextState.files).sort()) {
    if (!same(nextState.prior[path], nextState.files[path]))
      transitionPaths.push(path);
    if (same(installedProjection[path], nextState.files[path])) {
      alreadyCurrent.push(path);
      continue;
    }
    if (same(installedProjection[path], nextState.prior[path])) {
      replace.push(path);
      continue;
    }
    throw new TypeError(
      `installed bootstrap path is neither prior nor current: ${path}`
    );
  }
  if (!transitionPaths.length)
    throw new TypeError('bootstrap replacement transition required');
  return {
    baselineKind: pristine ? 'pristine' : 'complete',
    baselineSourceSha: baselineState.sourceSha,
    baselineStateSha256: pristine
      ? baselineState.captureSha256
      : baselineState.receiptSha256,
    sourceSha: nextState.sourceSha,
    captureSha256: nextState.captureSha256,
    installedProjectionSha256: digest(installedProjection),
    pathSetSha256: digest(Object.keys(nextState.files).sort()),
    policyFileSha256: nextState.policyFileSha256,
    authorityChain: authorityChain.map((state) => ({
      sourceSha: state.sourceSha,
      stateSha256:
        state.phase === 'complete' ? state.receiptSha256 : state.captureSha256,
    })),
    transitionPaths,
    replace,
    alreadyCurrent,
  };
}

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
  if (
    previous.phase !== 'captured' ||
    !same(paths, Object.keys(previous.files ?? {}).sort()) ||
    !same(paths, Object.keys(previous.prior ?? {}).sort())
  )
    return false;
  return paths.every(
    (path) =>
      same(next.prior[path], previous.prior[path]) ||
      same(next.prior[path], previous.files[path])
  );
}

const canPrecedeCompleted = (previous, next) =>
  next?.phase === 'complete' &&
  canFollow(previous, { ...next, phase: 'captured' });

function hasUniqueCompletedHistory(states, baseline) {
  if (states.some((state) => state.phase !== 'complete')) return false;
  const count = (next, remaining) => {
    if (!remaining.length) return 1;
    let output = 0;
    for (const [index, previous] of remaining.entries()) {
      if (!canPrecedeCompleted(previous, next)) continue;
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
    if (
      next.phase === 'complete' ||
      (next.phase === 'captured' &&
        Object.values(next.prior ?? {}).every((value) => value.absent === true))
    )
      return [[next]];
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
    hasUniqueCompletedHistory(
      states.filter((state) => !chain.includes(state)),
      chain[0]
    )
  );
  if (chains.length !== 1)
    throw new TypeError('invalid bootstrap replacement authority chain');
  return chains[0];
}
