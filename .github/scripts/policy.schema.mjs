import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

import { canonicalSha256 } from './canonical-json.mjs';

const policyUrl = new URL('./policy.json', import.meta.url);
const frozenWirePolicy = deepFreeze(
  JSON.parse(readFileSync(policyUrl, 'utf8'))
);
const frozenPolicy = deepFreeze(expandCompactPolicy(frozenWirePolicy));
canonicalSha256(frozenPolicy);

export const pinnedRunnerIdentity = Object.freeze({
  runnerGid: frozenPolicy.host.runnerGid,
  runnerName: frozenPolicy.runner.name,
});

export function parseRunnerPolicy(value) {
  try {
    canonicalSha256(value);
  } catch {
    throw new TypeError('invalid runner policy');
  }
  if (!isDeepStrictEqual(value, frozenWirePolicy)) {
    throw new TypeError('invalid runner policy');
  }
  return frozenPolicy;
}

export function requireRunnerPolicy(value) {
  if (value !== frozenPolicy) throw new TypeError('invalid runner policy');
  return frozenPolicy;
}

function decodeList(value) {
  return value.split('|');
}

function decodeExecutable(value, phaseCount) {
  const parts = typeof value === 'string' ? value.split('|') : [];
  const [path, phaseCounts] = parts;
  const maxInstancesByPhase = phaseCounts?.split(',').map(Number) ?? [];
  if (
    parts.length !== 2 ||
    !path ||
    maxInstancesByPhase.length !== phaseCount ||
    maxInstancesByPhase.some((count) => !Number.isInteger(count) || count < 0)
  )
    throw new TypeError('invalid executable descriptor');
  return {
    path,
    maxInstancesByPhase,
  };
}

function expandCompactPolicy(policy) {
  const artifactDownload = policy.repositoryAuthority.artifactDownload;
  const runtime = policy.dedicatedRuntime;
  const processAllowSet = policy.processAllowSet;
  const provenance = policy.supplyChainProvenance;
  return {
    ...policy,
    repositoryAuthority: {
      ...policy.repositoryAuthority,
      artifactDownload: {
        ...artifactDownload,
        allowedQueryKeys: decodeList(artifactDownload.allowedQueryKeys),
      },
    },
    processAllowSet: {
      ...processAllowSet,
      executables: Object.fromEntries(
        Object.entries(processAllowSet.executables).map(([role, value]) => [
          role,
          decodeExecutable(value, processAllowSet.phases.length),
        ])
      ),
    },
    installationImport: {
      ...policy.installationImport,
      workerServices: decodeList(policy.installationImport.workerServices),
    },
    dedicatedRuntime: {
      ...runtime,
      deniedDestinationCidrs: decodeList(runtime.deniedDestinationCidrs),
    },
    ruleset: {
      ...policy.ruleset,
      tagIncludes: decodeList(policy.ruleset.tagIncludes),
    },
    supplyChainProvenance: {
      ...provenance,
      immutableArtifactMediaTypes: Object.fromEntries(
        Object.entries(provenance.immutableArtifactMediaTypes).map(
          ([role, value]) => [role, decodeList(value)]
        )
      ),
    },
  };
}

function deepFreeze(value) {
  if (value === null || typeof value !== 'object') return value;
  if (!Object.isFrozen(value)) Object.freeze(value);
  for (const nestedValue of Object.values(value)) deepFreeze(nestedValue);
  return value;
}

export function deriveCampaignMark(transactionId) {
  if (typeof transactionId !== 'string' || transactionId.length === 0) {
    throw new TypeError('invalid transaction id');
  }
  const accounting = frozenPolicy.networkAccounting;
  const hashWord = createHash('sha256')
    .update(transactionId, 'utf8')
    .digest()
    .readUInt32BE(0);
  const hashMask = 2 ** accounting.markHashBits - 1;
  return (accounting.markPrefix | (hashWord & hashMask)) >>> 0;
}

function decodePointer(pointer) {
  if (pointer === '') return [];
  if (!pointer.startsWith('/')) throw new TypeError('invalid JSON pointer');
  return pointer
    .slice(1)
    .split('/')
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'));
}

function getAtPointer(value, pointer) {
  let current = value;
  for (const part of decodePointer(pointer)) {
    if (
      current === null ||
      typeof current !== 'object' ||
      !Object.hasOwn(current, part)
    ) {
      throw new TypeError('JSON pointer not found');
    }
    current = current[part];
  }
  return current;
}

function printValue(value) {
  if (typeof value === 'string') process.stdout.write(`${value}\n`);
  else process.stdout.write(`${JSON.stringify(value)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [command, argument] = process.argv.slice(2);
  if (command === 'get' && argument !== undefined) {
    printValue(getAtPointer(frozenPolicy, argument));
  } else if (command === 'campaign-mark' && argument !== undefined) {
    printValue(deriveCampaignMark(argument));
  } else {
    throw new TypeError(
      'usage: policy.schema.mjs get <json-pointer> | campaign-mark <transaction-id>'
    );
  }
}
