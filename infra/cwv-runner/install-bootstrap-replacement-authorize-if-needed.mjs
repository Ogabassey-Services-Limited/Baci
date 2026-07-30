import { basename, join } from 'node:path';
import { readBootstrapState } from './install-bootstrap.mjs';
import { reconcileBootstrapPreCapture } from './install-bootstrap-pre-capture.mjs';
import { authorizeBootstrapReplacement } from './install-bootstrap-replacement-authorize.mjs';
import { readBootstrapReplacementDownstream } from './install-bootstrap-replacement-downstream.mjs';
import { isBootstrapReplacementNoop } from './install-bootstrap-replacement-noop.mjs';
import { reconcileBootstrapReplacementResidue } from './install-bootstrap-replacement-residue.mjs';
import { readBootstrapReplacementStateInventory } from './install-bootstrap-replacement-state-inventory.mjs';

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
    for (const name of inventory) {
      if (name === basename(currentDirectory)) continue;
      try {
        await readState(join(stateRoot, name));
      } catch {
        await reconcileBootstrapPreCapture(join(stateRoot, name), dependencies);
      }
    }
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
            intent: { authorityChain: [] },
          },
        },
        dependencies
      );
    return null;
  }
  const names = inventory.filter((name) => name !== basename(currentDirectory));
  if (!names.length) {
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
