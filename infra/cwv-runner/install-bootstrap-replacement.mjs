import { createHash } from 'node:crypto';
import { resolveBootstrapReplacementChain } from './install-bootstrap-replacement-chain.mjs';
import { isBootstrapReplacementNoop } from './install-bootstrap-replacement-noop.mjs';

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
  if (isBootstrapReplacementNoop(nextState)) return null;
  const resolvedAuthorityChain = resolveBootstrapReplacementChain(
    authorityChain,
    nextState
  );
  if (
    !Array.isArray(authorityChain) ||
    authorityChain.length < 2 ||
    authorityChain.at(-1) !== nextState ||
    !same(resolvedAuthorityChain, authorityChain)
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
  let hasTransition = false;
  for (const path of Object.keys(nextState.files).sort()) {
    transitionPaths.push(path);
    if (!same(nextState.prior[path], nextState.files[path]))
      hasTransition = true;
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
  if (!hasTransition)
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
