// biome-ignore-all format: compact closed CLI stays below the repository file limit
import { readFileSync } from 'node:fs';
import {
  createChallenge,
  createFinalAllow,
  validateAdmission,
  validateInventoryReceipt,
  validateProcessInventory,
  validateRelease,
} from './exact-run-contract.mjs';
import { createCanonicalNormalRelease } from './normal-release.mjs';

function usage() {
  throw new Error('closed exact-run contract invocation required');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function number(value) {
  if (!/^(?:0|[1-9][0-9]*)$/.test(value ?? '')) usage();
  return Number(value);
}
function normalRelease({ binding, captureSha256, classifierSha256, held, now, runtime, liveSampleSha256, expiresMonotonicSeconds }) {
  if (
    runtime?.campaignId !== binding.campaignId ||
    held?.campaignId !== binding.campaignId ||
    runtime?.runnerContainerId !== held?.runnerContainerId ||
    runtime?.runnerIp !== held?.runnerIp ||
    runtime?.runnerVeth !== held?.runnerVeth ||
    runtime?.runnerPeerIfindex !== held?.runnerPeerIfindex
  ) usage();
  return createCanonicalNormalRelease({
    campaignId: binding.campaignId,
    captureSha256,
    classifierSha256,
    containerId: runtime.runnerContainerId,
    createdMonotonicSeconds: now,
    egressIdentity: `external:${runtime.externalInterface}:${runtime.externalIfindex}`,
    expiresMonotonicSeconds,
    liveSampleSha256,
    peerIdentity: `veth:${runtime.runnerVeth}:${runtime.runnerPeerIfindex}`,
    policyFileSha256: binding.policyFileSha256,
    runnerIp: runtime.runnerIp,
    vethIdentity: runtime.runnerVeth,
  });
}

const [mode, ...args] = process.argv.slice(2);
let result;

switch (mode) {
  case 'create-challenge': {
    if (args.length !== 6) usage();
    const [bindingPath, kind, nonce, now, ttl, bootId] = args;
    result = createChallenge({
      binding: readJson(bindingPath),
      bootId,
      kind,
      nonce,
      nowMonotonicSeconds: number(now),
      ttlSeconds: number(ttl),
    });
    break;
  }
  case 'create-final-allow': {
    if (args.length !== 3) usage();
    const [bindingPath, receiptPath, now] = args;
    result = createFinalAllow({
      binding: readJson(bindingPath),
      inventoryReceipt: readJson(receiptPath),
      nowMonotonicSeconds: number(now),
    });
    break;
  }
  case 'validate-admission': {
    if (args.length !== 5) usage();
    const [bindingPath, challengePath, documentPath, now, bootId] = args;
    result = validateAdmission({
      binding: readJson(bindingPath),
      bootId,
      challenge: readJson(challengePath),
      document: readJson(documentPath),
      nowMonotonicSeconds: number(now),
    });
    break;
  }
  case 'validate-inventory': {
    if (args.length !== 8) usage();
    const [bindingPath, challengePath, documentPath, holdPath, runnerPath, now, ttl, bootId] = args;
    result = validateInventoryReceipt({
      binding: readJson(bindingPath),
      bootId,
      challenge: readJson(challengePath),
      document: readJson(documentPath),
      holdDigest: readFileSync(holdPath, 'utf8').trim(),
      nowMonotonicSeconds: number(now),
      requiredRunner: readJson(runnerPath),
      ttlSeconds: number(ttl),
    });
    break;
  }
  case 'create-normal-release': {
    if (args.length !== 10) usage();
    const [bindingPath, receiptPath, classifierPath, holdPath, samplePath, runtimePath, heldPath, captureSha256, now, deadline] = args;
    const binding = readJson(bindingPath);
    const inventoryReceipt = readJson(receiptPath);
    const classifierSha256 = readFileSync(classifierPath, 'utf8').trim();
    const holdDigest = readFileSync(holdPath, 'utf8').trim();
    const liveSampleSha256 = readFileSync(samplePath, 'utf8').trim();
    const createdMonotonicSeconds = number(now);
    const expiresMonotonicSeconds = number(deadline);
    validateRelease({ binding, classifierDigest: classifierSha256, holdDigest, inventoryReceipt, liveSampleDigest: liveSampleSha256, nowMonotonicSeconds: createdMonotonicSeconds });
    result = normalRelease({ binding, captureSha256, classifierSha256, held: readJson(heldPath), now: createdMonotonicSeconds, runtime: readJson(runtimePath), liveSampleSha256, expiresMonotonicSeconds });
    break;
  }
  case 'validate-process': {
    if (args.length !== 6) usage();
    const [phase, busy, runId, processMapPath, identityPath, inventoryPath] = args;
    result = validateProcessInventory({
      busy: busy === 'true',
      expectedRunId: number(runId),
      identity: readJson(identityPath),
      phase,
      processMap: readJson(processMapPath),
      processes: readJson(inventoryPath),
    });
    break;
  }
  default:
    usage();
}

process.stdout.write(typeof result === 'string' ? result : JSON.stringify(result));
