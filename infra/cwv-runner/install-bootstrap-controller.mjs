import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  appendBootstrapJournal,
  beginBootstrap,
  completeBootstrap,
  persistBootstrapCapture,
  persistBootstrapReceipt,
  readBootstrapState,
} from './install-bootstrap.mjs';
import { readInstalledProjection } from './install-bootstrap-installed.mjs';
import { buildBootstrapInput } from './install-bootstrap-plan.mjs';
import { reconcileBootstrapPreCapture } from './install-bootstrap-pre-capture.mjs';
import {
  authorizeBootstrapReplacement,
  authorizeBootstrapReplacementIfNeeded,
  completeBootstrapReplacement,
  persistBootstrapReplacementIntent,
  persistBootstrapReplacementReceipt,
  readBootstrapReplacementDownstream,
  readBootstrapReplacementIntent,
  readBootstrapReplacementReceipt,
  verifyBootstrapReplacementCompletion,
} from './install-bootstrap-replacement-controller.mjs';
import { readBootstrapReplacementStateInventory } from './install-bootstrap-replacement-state-inventory.mjs';

export { planBootstrapReplacement } from './install-bootstrap-replacement.mjs';
export { resolveBootstrapReplacementChain } from './install-bootstrap-replacement-chain.mjs';
export {
  authorizeBootstrapReplacement,
  authorizeBootstrapReplacementIfNeeded,
  completeBootstrapReplacement,
  persistBootstrapReplacementIntent,
  persistBootstrapReplacementReceipt,
  readBootstrapReplacementDownstream,
  readBootstrapReplacementIntent,
  readBootstrapReplacementReceipt,
  verifyBootstrapReplacementCompletion,
};

export async function captureBootstrap(stateRoot, input) {
  const capture = beginBootstrap(input);
  const directory = join(stateRoot, capture.transactionId);
  try {
    await lstat(directory);
  } catch (error) {
    if (error.code === 'ENOENT')
      return await persistBootstrapCapture(stateRoot, capture);
    throw error;
  }
  try {
    await resumeBootstrap(directory, input);
    return directory;
  } catch {
    await reconcileBootstrapPreCapture(directory, { expectedCapture: capture });
    return await persistBootstrapCapture(stateRoot, capture);
  }
}

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

export async function resumeBootstrap(directory, input) {
  const state = await readBootstrapState(directory);
  if (
    state.transactionId !== input.transactionId ||
    state.sourceSha !== input.sourceSha ||
    state.sourceManifestSha256 !== input.sourceManifestSha256 ||
    state.policyFileSha256 !== input.policyFileSha256 ||
    !same(state.files, input.files)
  )
    throw new Error('bootstrap resume authority mismatch');
  return state;
}

export async function journalBootstrap(directory, action, path, sha256) {
  return await appendBootstrapJournal(directory, { action, path, sha256 });
}

export async function completeBootstrapTransaction(
  directory,
  liveUnitStates,
  readProjection = readInstalledProjection
) {
  const capture = await readBootstrapState(directory);
  const complete = completeBootstrap(
    capture,
    await readProjection(capture.files),
    liveUnitStates
  );
  await persistBootstrapReceipt(directory, complete);
  return complete;
}

export async function verifyBootstrapTransaction(
  directory,
  readProjection = readInstalledProjection
) {
  const state = await readBootstrapState(directory);
  if (state.phase !== 'complete' || !state.receiptSha256)
    throw new Error('complete bootstrap receipt required');
  if (!same(state.receipt.files, await readProjection(state.receipt.files)))
    throw new Error('installed bootstrap projection drift');
  return state;
}

async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function main(argv) {
  const [command, first, second, third, fourth, fifth] = argv;
  if (command === 'begin') {
    process.stdout.write(
      `${await captureBootstrap(first, await json(second))}\n`
    );
    return;
  }
  if (command === 'resume') {
    const state = await resumeBootstrap(first, await json(second));
    process.stdout.write(`${state.phase}\n`);
    return;
  }
  if (command === 'journal') {
    await journalBootstrap(first, second, third, fourth);
    return;
  }
  if (command === 'complete') {
    await completeBootstrapTransaction(first, await json(second));
    return;
  }
  if (command === 'verify') {
    if (second) await resumeBootstrap(first, await json(second));
    const state = await verifyBootstrapTransaction(first);
    process.stdout.write(`${state.receiptSha256}\n`);
    return;
  }
  if (command === 'verify-current') {
    const input = await buildBootstrapInput({
      sourceRoot: second,
      sourceSha: third,
      sourceManifestSha256: fourth,
      policyFileSha256: fifth,
      bootstrapFileSha256: argv[6],
      transactionId: argv[7],
    });
    await resumeBootstrap(first, input);
    const state = await verifyBootstrapTransaction(first);
    process.stdout.write(`${state.receiptSha256}\n`);
    return;
  }
  if (command === 'replacement-authorize') {
    const plan = await authorizeBootstrapReplacementIfNeeded({
      currentDirectory: first,
      stateRoot: second,
      root: third,
      prepareRoot: fourth,
    });
    process.stdout.write(`${plan ? JSON.stringify(plan) : 'none'}\n`);
    return;
  }
  if (command === 'replacement-inventory') {
    process.stdout.write(
      `${JSON.stringify(await readBootstrapReplacementStateInventory(first))}\n`
    );
    return;
  }
  if (command === 'replacement-complete') {
    await completeBootstrapReplacement({ currentDirectory: first });
    return;
  }
  if (command === 'replacement-verify') {
    await verifyBootstrapReplacementCompletion({ currentDirectory: first });
    return;
  }
  throw new Error(`unsupported bootstrap controller command: ${command}`);
}

if (import.meta.filename === process.argv[1]) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
