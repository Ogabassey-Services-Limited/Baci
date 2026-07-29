import { readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { readBootstrapState } from './install-bootstrap.mjs';
import { readInstalledProjection } from './install-bootstrap-installed.mjs';
import {
  planBootstrapReplacement,
  resolveBootstrapReplacementChain,
} from './install-bootstrap-replacement.mjs';
import { readBootstrapReplacementDownstream } from './install-bootstrap-replacement-downstream.mjs';
import {
  persistBootstrapReplacementIntent,
  persistBootstrapReplacementReceipt,
  readBootstrapReplacementIntent,
  readBootstrapReplacementReceipt,
} from './install-bootstrap-replacement-receipt.mjs';
import { validateBootstrapReplacementSourceState } from './install-bootstrap-replacement-source.mjs';

const TRANSACTION = /^bootstrap-[0-9a-f]{12}$/;
const HEX = /^[0-9a-f]{64}$/;
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

export {
  persistBootstrapReplacementIntent,
  persistBootstrapReplacementReceipt,
  readBootstrapReplacementDownstream,
  readBootstrapReplacementIntent,
  readBootstrapReplacementReceipt,
};

export async function authorizeBootstrapReplacement(
  { stateRoot, currentDirectory, downstreamState, sourceRoot, receiptRoot },
  dependencies = {}
) {
  const listDirectories = dependencies.listDirectories ?? readdir;
  const readState = dependencies.readState ?? readBootstrapState;
  const readProjection = dependencies.readProjection ?? readInstalledProjection;
  const persistIntent =
    dependencies.persistIntent ?? persistBootstrapReplacementIntent;
  const readIntent = dependencies.readIntent ?? readBootstrapReplacementIntent;
  const validateSourceState =
    dependencies.validateSourceState ?? validateBootstrapReplacementSourceState;
  if (!TRANSACTION.test(basename(currentDirectory)))
    throw new TypeError('invalid current bootstrap transaction');
  const nextState = await readState(currentDirectory);
  const names = await listDirectories(stateRoot);
  if (names.some((name) => !TRANSACTION.test(name)))
    throw new TypeError('invalid bootstrap replacement state inventory');
  const states = [nextState];
  for (const name of names) {
    if (name === basename(currentDirectory)) continue;
    states.push(await readState(join(stateRoot, name)));
  }
  const provenance = new Map();
  for (const state of states)
    provenance.set(
      state.sourceSha,
      await validateSourceState({ state, sourceRoot, receiptRoot })
    );
  const authorityChain = resolveBootstrapReplacementChain(states, nextState);
  const plan = planBootstrapReplacement({
    authorityChain,
    nextState,
    installedProjection: await readProjection(nextState.files),
    downstreamState,
  });
  const intent = {
    schemaVersion: 1,
    baselineKind: plan.baselineKind,
    baselineSourceSha: plan.baselineSourceSha,
    baselineStateSha256: plan.baselineStateSha256,
    sourceSha: plan.sourceSha,
    captureSha256: plan.captureSha256,
    installedProjectionSha256: plan.installedProjectionSha256,
    pathSetSha256: plan.pathSetSha256,
    policyFileSha256: plan.policyFileSha256,
    authorityChain: plan.authorityChain.map((row) => ({
      ...row,
      journalTipSha256: provenance.get(row.sourceSha).journalTipSha256,
      sealReceiptSha256: provenance.get(row.sourceSha).sealReceiptSha256,
    })),
    transitionPaths: plan.transitionPaths,
  };
  let existing;
  try {
    existing = await readIntent(currentDirectory);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (existing) {
    if (
      !same(existing, {
        ...intent,
        installedProjectionSha256: existing.installedProjectionSha256,
      })
    )
      throw new TypeError('bootstrap replacement intent authority drift');
  } else await persistIntent(currentDirectory, intent);
  return plan;
}

export async function authorizeBootstrapReplacementIfNeeded(
  { stateRoot, currentDirectory, root, prepareRoot },
  dependencies = {}
) {
  const listDirectories = dependencies.listDirectories ?? readdir;
  const readState = dependencies.readState ?? readBootstrapState;
  const inventory = await listDirectories(stateRoot);
  if (inventory.some((name) => !TRANSACTION.test(name)))
    throw new TypeError('invalid bootstrap replacement state inventory');
  const names = inventory.filter((name) => name !== basename(currentDirectory));
  if (!names.length) {
    const state = await readState(currentDirectory);
    if (
      Object.values(state.prior ?? {}).every((value) => value.absent === true)
    )
      return null;
    throw new TypeError('prior bootstrap generation required');
  }
  const readDownstream =
    dependencies.readDownstream ?? readBootstrapReplacementDownstream;
  return await authorizeBootstrapReplacement(
    {
      stateRoot,
      currentDirectory,
      downstreamState: await readDownstream({ root, prepareRoot }),
      sourceRoot: join(root, 'source'),
      receiptRoot: join(root, 'source-receipts'),
    },
    dependencies
  );
}

export async function completeBootstrapReplacement(
  { currentDirectory },
  dependencies = {}
) {
  const readState = dependencies.readState ?? readBootstrapState;
  const readProjection = dependencies.readProjection ?? readInstalledProjection;
  const readIntent = dependencies.readIntent ?? readBootstrapReplacementIntent;
  const persistReceipt =
    dependencies.persistReceipt ?? persistBootstrapReplacementReceipt;
  const [state, intent] = await Promise.all([
    readState(currentDirectory),
    readIntent(currentDirectory),
  ]);
  if (
    state.phase !== 'complete' ||
    state.sourceSha !== intent.sourceSha ||
    state.captureSha256 !== intent.captureSha256 ||
    !HEX.test(state.receiptSha256 ?? '') ||
    !same(state.receipt?.files, await readProjection(state.receipt?.files))
  )
    throw new TypeError('completed replacement projection required');
  const receipt = { ...intent, receiptSha256: state.receiptSha256 };
  await persistReceipt(currentDirectory, receipt);
  return receipt;
}

export async function verifyBootstrapReplacementCompletion(
  { currentDirectory },
  dependencies = {}
) {
  const readState = dependencies.readState ?? readBootstrapState;
  const readIntent = dependencies.readIntent ?? readBootstrapReplacementIntent;
  const readReceipt =
    dependencies.readReceipt ?? readBootstrapReplacementReceipt;
  const [state, intent, receipt] = await Promise.all([
    readState(currentDirectory),
    readIntent(currentDirectory),
    readReceipt(currentDirectory),
  ]);
  if (
    state.phase !== 'complete' ||
    !HEX.test(state.receiptSha256 ?? '') ||
    !same(receipt, { ...intent, receiptSha256: state.receiptSha256 })
  )
    throw new TypeError('completed replacement receipt required');
  return receipt;
}
