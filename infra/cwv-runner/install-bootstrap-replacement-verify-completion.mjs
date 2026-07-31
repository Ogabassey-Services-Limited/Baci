import { canonicalJson } from './canonical-json.mjs';
import { readBootstrapState } from './install-bootstrap.mjs';
import {
  readBootstrapReplacementIntent,
  readBootstrapReplacementReceipt,
} from './install-bootstrap-replacement-receipt.mjs';

const HEX = /^[0-9a-f]{64}$/;
const same = (left, right) => canonicalJson(left) === canonicalJson(right);

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
