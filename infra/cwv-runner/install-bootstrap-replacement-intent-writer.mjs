import { persistBoundReplacement } from './install-bootstrap-replacement-bound-writer.mjs';

export async function persistBootstrapReplacementIntent(
  directory,
  intent,
  dependencies
) {
  return await persistBoundReplacement(
    directory,
    'replacement-intent',
    intent,
    'bootstrap replacement intent drift',
    dependencies
  );
}
