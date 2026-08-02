import { persistBoundReplacement } from './install-bootstrap-replacement-bound-writer.mjs';

export async function persistBootstrapReplacementReceipt(
  directory,
  receipt,
  dependencies
) {
  return await persistBoundReplacement(
    directory,
    'replacement-receipt',
    receipt,
    'bootstrap replacement receipt drift',
    dependencies
  );
}
