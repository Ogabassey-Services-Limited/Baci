import { readBoundReplacement } from './install-bootstrap-replacement-bound-reader.mjs';

export async function readBootstrapReplacementReceipt(directory) {
  return await readBoundReplacement(directory, 'replacement-receipt', true);
}
