import { basename, join } from 'node:path';
import { readBootstrapState } from './install-bootstrap.mjs';
import { authorizeBootstrapReplacement } from './install-bootstrap-replacement-authorize.mjs';
import { readBootstrapReplacementDownstream } from './install-bootstrap-replacement-downstream.mjs';
import { readBootstrapReplacementStateInventory } from './install-bootstrap-replacement-state-inventory.mjs';

export async function authorizeBootstrapReplacementIfNeeded(
  { stateRoot, currentDirectory, root, prepareRoot },
  dependencies = {}
) {
  const readState = dependencies.readState ?? readBootstrapState;
  const inventory = await readBootstrapReplacementStateInventory(
    stateRoot,
    dependencies
  );
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
