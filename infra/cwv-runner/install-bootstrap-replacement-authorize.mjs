import { basename, join } from 'node:path';
import { canonicalJson } from './canonical-json.mjs';
import { readBootstrapState } from './install-bootstrap.mjs';
import { readInstalledProjection } from './install-bootstrap-installed.mjs';
import { reconcileBootstrapPreCapture } from './install-bootstrap-pre-capture.mjs';
import { planBootstrapReplacement } from './install-bootstrap-replacement.mjs';
import { resolveBootstrapReplacementChain } from './install-bootstrap-replacement-chain.mjs';
import {
  persistBootstrapReplacementIntent,
  readBootstrapReplacementIntent,
} from './install-bootstrap-replacement-receipt.mjs';
import { validateBootstrapReplacementSourceState } from './install-bootstrap-replacement-source.mjs';
import { readBootstrapReplacementStateInventory } from './install-bootstrap-replacement-state-inventory.mjs';

const TRANSACTION = /^bootstrap-[0-9a-f]{12}$/;
const same = (left, right) => canonicalJson(left) === canonicalJson(right);

export async function authorizeBootstrapReplacement(
  { stateRoot, currentDirectory, downstreamState, sourceRoot, receiptRoot },
  dependencies = {}
) {
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
  const names = await readBootstrapReplacementStateInventory(
    stateRoot,
    dependencies
  );
  const states = [nextState];
  for (const name of names) {
    if (name === basename(currentDirectory)) continue;
    const directory = join(stateRoot, name);
    try {
      states.push(await readState(directory));
    } catch {
      await reconcileBootstrapPreCapture(directory, dependencies);
    }
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
  if (!plan) return null;
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
    const existingCurrent = existing.authorityChain.find(
      (row) => row.sourceSha === intent.sourceSha
    );
    const comparableAuthorityChain = intent.authorityChain.map((row) =>
      row.sourceSha === intent.sourceSha && existingCurrent
        ? { ...row, journalTipSha256: existingCurrent.journalTipSha256 }
        : row
    );
    if (
      !same(existing, {
        ...intent,
        authorityChain: comparableAuthorityChain,
        installedProjectionSha256: existing.installedProjectionSha256,
      })
    )
      throw new TypeError('bootstrap replacement intent authority drift');
  } else await persistIntent(currentDirectory, intent);
  return plan;
}
