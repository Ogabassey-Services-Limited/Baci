import { canonicalJson } from './canonical-json.mjs';
import { readBootstrapState } from './install-bootstrap.mjs';
import { readInstalledProjection } from './install-bootstrap-installed.mjs';
import {
  persistBootstrapReplacementReceipt,
  readBootstrapReplacementIntent,
} from './install-bootstrap-replacement-receipt.mjs';

const HEX = /^[0-9a-f]{64}$/;
const same = (left, right) => canonicalJson(left) === canonicalJson(right);

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
