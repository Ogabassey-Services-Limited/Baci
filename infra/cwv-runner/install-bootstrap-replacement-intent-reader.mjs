import { readBoundReplacement } from './install-bootstrap-replacement-bound-reader.mjs';

export async function readBootstrapReplacementIntent(directory) {
  return await readBoundReplacement(directory, 'replacement-intent', false);
}
