import { createHash } from 'node:crypto';
import { basename, join } from 'node:path';
import { readBootstrapState } from './install-bootstrap.mjs';
import { reconcileBootstrapPreCapture } from './install-bootstrap-pre-capture.mjs';
import { authorizeBootstrapReplacement } from './install-bootstrap-replacement-authorize.mjs';
import { resolveBootstrapReplacementChain } from './install-bootstrap-replacement-chain.mjs';
import { readBootstrapReplacementDownstream } from './install-bootstrap-replacement-downstream.mjs';
import { isBootstrapReplacementNoop } from './install-bootstrap-replacement-noop.mjs';
import { reconcileBootstrapReplacementResidue } from './install-bootstrap-replacement-residue.mjs';
import { readBootstrapReplacementStateInventory } from './install-bootstrap-replacement-state-inventory.mjs';
import { reconcileBootstrapWatchdogResidue } from './install-bootstrap-watchdog-residue.mjs';

const watchdogDestination = (files) =>
  Object.keys(files ?? {}).find(
    (destination) =>
      basename(destination) === 'baci-cwv-campaign-watchdog@.service'
  );
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export async function authorizeBootstrapReplacementIfNeeded(
  { stateRoot, currentDirectory, root, prepareRoot },
  dependencies = {}
) {
  const readState = dependencies.readState ?? readBootstrapState;
  const currentState = await readState(currentDirectory);
  const inventory = await readBootstrapReplacementStateInventory(
    stateRoot,
    dependencies
  );
  if (isBootstrapReplacementNoop(currentState)) {
    const states = [currentState];
    for (const name of inventory) {
      if (name === basename(currentDirectory)) continue;
      try {
        states.push(await readState(join(stateRoot, name)));
      } catch {
        await reconcileBootstrapPreCapture(join(stateRoot, name), dependencies);
      }
    }
    const authorityChain = resolveBootstrapReplacementChain(
      states,
      currentState
    ).map((state) => ({
      sourceSha: state.sourceSha,
      stateSha256:
        state.phase === 'complete' ? state.receiptSha256 : state.captureSha256,
    }));
    for (const destination of Object.keys(currentState.files).sort())
      await reconcileBootstrapReplacementResidue(
        {
          destination,
          prior: currentState.prior[destination],
          expected: currentState.files[destination],
          authorizedState: {
            ...currentState,
            currentDirectory,
            destination,
            intent: { authorityChain },
          },
        },
        dependencies
      );
    const destination = watchdogDestination(currentState.files);
    if (destination)
      await reconcileBootstrapWatchdogResidue(
        { currentDirectory, destination },
        {
          ...dependencies,
          intent: {
            sourceSha: currentState.sourceSha,
            captureSha256: currentState.captureSha256,
            policyFileSha256: currentState.policyFileSha256,
            pathSetSha256: sha256(
              JSON.stringify(Object.keys(currentState.files).sort())
            ),
            transitionPaths: [destination],
            authorityChain,
          },
        }
      );
    return null;
  }
  const names = inventory.filter((name) => name !== basename(currentDirectory));
  if (!names.length) {
    for (const destination of Object.keys(currentState.files ?? {}).sort())
      await reconcileBootstrapReplacementResidue(
        {
          destination,
          prior: currentState.prior?.[destination],
          expected: currentState.files[destination],
          authorizedState: currentState,
        },
        dependencies
      );
    if (
      Object.values(currentState.prior ?? {}).every(
        (value) => value.absent === true
      )
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
