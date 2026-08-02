import { dirname, join } from 'node:path';
import { canonicalJson } from './canonical-json.mjs';

const SOURCE = /^[0-9a-f]{40}$/;
const same = (left, right) => canonicalJson(left) === canonicalJson(right);
const allowedOwners = new Set(['root:root', 'root:baci-cwv']);

const stateDigest = (state) => {
  if (state?.phase === 'captured') return state.captureSha256;
  if (state?.phase === 'complete') return state.receiptSha256;
};

export async function retireObsolete(
  actual,
  bound,
  authorizedState,
  temporary,
  dependencies
) {
  const boundExpectedSha256 = bound[2];
  const { destination } = authorizedState;
  if (
    actual.sha256 === boundExpectedSha256 &&
    actual.mode === '0600' &&
    allowedOwners.has(actual.owner)
  )
    return await removeTemporary(temporary, dependencies);
  if (!Array.isArray(authorizedState.intent.authorityChain))
    throw new TypeError('bootstrap replacement temporary drift');
  const priorRows = authorizedState.intent.authorityChain.slice(0, -1);
  for (const row of priorRows) {
    if (!SOURCE.test(row?.sourceSha ?? '')) continue;
    let state;
    try {
      state = await dependencies.readState(
        join(
          dirname(authorizedState.currentDirectory),
          `bootstrap-${row.sourceSha.slice(0, 12)}`
        )
      );
    } catch {
      continue;
    }
    if (
      state?.sourceSha !== row.sourceSha ||
      stateDigest(state) !== row.stateSha256 ||
      state.files?.[destination]?.sha256 !== boundExpectedSha256 ||
      !same(actual, state.prior?.[destination])
    )
      continue;
    return await removeTemporary(temporary, dependencies);
  }
  throw new TypeError('bootstrap replacement temporary drift');
}

async function removeTemporary(temporary, dependencies) {
  await dependencies.removeFile(temporary);
  await dependencies.syncDirectory(dirname(temporary));
}
