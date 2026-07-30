import { createHash } from 'node:crypto';
import { basename, dirname, join } from 'node:path';
import { readBootstrapState } from './install-bootstrap.mjs';
import { readPinnedBootstrapFile } from './install-bootstrap-installed.mjs';
import { reconcileBootstrapPreCapture } from './install-bootstrap-pre-capture.mjs';
import { authorizeBootstrapReplacement } from './install-bootstrap-replacement-authorize.mjs';
import { resolveBootstrapReplacementChain } from './install-bootstrap-replacement-chain.mjs';
import { readBootstrapReplacementDownstream } from './install-bootstrap-replacement-downstream.mjs';
import { isBootstrapReplacementNoop } from './install-bootstrap-replacement-noop.mjs';
import { reconcileBootstrapReplacementResidue } from './install-bootstrap-replacement-residue.mjs';
import { validateBootstrapReplacementSourceState } from './install-bootstrap-replacement-source.mjs';
import { readBootstrapReplacementStateInventory } from './install-bootstrap-replacement-state-inventory.mjs';
import { reconcileBootstrapWatchdogResidue } from './install-bootstrap-watchdog-residue.mjs';

const watchdogDestination = (files) =>
  Object.keys(files ?? {}).find(
    (destination) =>
      basename(destination) === 'baci-cwv-campaign-watchdog@.service'
  );
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

async function readAuthenticatedGenerationBytes(
  state,
  destination,
  root,
  dependencies
) {
  const readPinned = dependencies.readPinned ?? readPinnedBootstrapFile;
  const source = join(root, 'source', state.sourceSha);
  let bytes;
  if (destination === '/srv/baci-cwv/sealed/policy.sha256')
    bytes = Buffer.from(`${state.policyFileSha256}\n`);
  else if (destination === '/srv/baci-cwv/sealed/source-manifest.sha256')
    bytes = Buffer.from(`${state.sourceManifestSha256}\n`);
  else if (destination === '/srv/baci-cwv/sealed/bootstrap.sha256')
    bytes = Buffer.from(
      `${sha256((await readPinned(join(source, 'install.sh'))).bytes)}\n`
    );
  else {
    bytes = (await readPinned(join(source, basename(destination)))).bytes;
    if (
      destination === '/etc/systemd/system/baci-cwv-campaign-watchdog@.service'
    )
      bytes = Buffer.from(
        bytes.toString('utf8').replace('@BACI_CWV_SOURCE_SHA@', state.sourceSha)
      );
  }
  if (sha256(bytes) !== state.files[destination]?.sha256)
    throw new TypeError('authenticated bootstrap source bytes drift');
  return bytes;
}

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
    const expectedBytes = new Map();
    let validatedSource;
    const validateSource = () => {
      validatedSource ??= Promise.resolve(
        (
          dependencies.validateSourceState ??
          validateBootstrapReplacementSourceState
        )(
          {
            state: currentState,
            sourceRoot: join(root, 'source'),
            receiptRoot: join(root, 'source-receipts'),
          },
          dependencies
        )
      );
      return validatedSource;
    };
    const readExpectedBytes = (destination) => {
      if (!expectedBytes.has(destination))
        expectedBytes.set(
          destination,
          validateSource().then(() =>
            readAuthenticatedGenerationBytes(
              currentState,
              destination,
              root,
              dependencies
            )
          )
        );
      return expectedBytes.get(destination);
    };
    const readExpectedDirectoryBytes = (destination) =>
      Promise.all(
        Object.keys(currentState.files)
          .filter((path) => dirname(path) === dirname(destination))
          .sort()
          .map(readExpectedBytes)
      );
    for (const destination of Object.keys(currentState.files ?? {}).sort())
      await reconcileBootstrapReplacementResidue(
        {
          destination,
          prior: currentState.prior?.[destination],
          expected: currentState.files[destination],
          expectedBytes: () => readExpectedDirectoryBytes(destination),
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
