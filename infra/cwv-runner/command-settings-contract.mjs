import { createHash } from 'node:crypto';

import { canonicalJson } from './canonical-json.mjs';

const HEX_256 = /^[0-9a-f]{64}$/;
const fail = (reason) => {
  throw new TypeError(`invalid CommandSettings ${reason}`);
};

const receiptKeys = [
  'commandSettingsSha256',
  'commandSettingsUrl',
  'nodeProcessExecve',
  'runnerSha256',
  'runnerVersion',
  'schemaVersion',
  'secretInputContract',
];

function assertReceiptShape(receipt) {
  if (
    receipt === null ||
    typeof receipt !== 'object' ||
    Array.isArray(receipt) ||
    JSON.stringify(Object.keys(receipt).sort()) !== JSON.stringify(receiptKeys)
  )
    fail('receipt schema');
  if (
    receipt.schemaVersion !== 1 ||
    typeof receipt.commandSettingsUrl !== 'string' ||
    !HEX_256.test(receipt.commandSettingsSha256) ||
    !HEX_256.test(receipt.runnerSha256) ||
    typeof receipt.runnerVersion !== 'string' ||
    receipt.runnerVersion.length === 0 ||
    receipt.nodeProcessExecve !== true ||
    canonicalJson(receipt.secretInputContract) !==
      canonicalJson({
        copiedToArgumentMap: true,
        masked: true,
        removedFromEnvironment: true,
      })
  )
    fail('receipt binding');
}

export function serializeCommandSettingsReceipt(receipt) {
  assertReceiptShape(receipt);
  return Buffer.from(canonicalJson(receipt), 'utf8');
}

export function parseCanonicalCommandSettingsReceipt(raw, policy) {
  if (!Buffer.isBuffer(raw) && typeof raw !== 'string') fail('receipt bytes');
  const bytes = Buffer.isBuffer(raw) ? raw : Buffer.from(raw, 'utf8');
  let receipt;
  try {
    receipt = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail('receipt JSON');
  }
  const canonical = serializeCommandSettingsReceipt(receipt);
  if (!canonical.equals(bytes)) fail('receipt canonical bytes refused');
  const runner = policy?.supplyChain?.runner;
  if (
    !runner ||
    receipt.commandSettingsUrl !== runner.commandSettingsUrl ||
    receipt.commandSettingsSha256 !== runner.commandSettingsSha256 ||
    receipt.runnerVersion !== runner.version ||
    receipt.runnerSha256 !== runner.sha256
  )
    fail('receipt binding');
  return Object.freeze(receipt);
}

export function verifyCommandSettingsContract({
  expectedSha256,
  runnerArchiveSha256,
  runnerVersion,
  source,
  sourceUrl,
}) {
  if (typeof source !== 'string' || typeof sourceUrl !== 'string')
    fail('input');
  let parsedUrl;
  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    fail('URL');
  }
  if (
    parsedUrl.protocol !== 'https:' ||
    parsedUrl.origin !== 'https://raw.githubusercontent.com' ||
    parsedUrl.username ||
    parsedUrl.password
  )
    fail('URL');
  if (!HEX_256.test(runnerArchiveSha256)) fail('runner archive');
  const sourceSha256 = createHash('sha256').update(source).digest('hex');
  if (!HEX_256.test(expectedSha256) || sourceSha256 !== expectedSha256)
    fail('hash');
  const identifier = '[A-Za-z_][A-Za-z0-9_]*';
  const prefix =
    '(?:Constants\\.Runner\\.CommandLine\\.Args\\.EnvironmentVariablePrefix|["\']ACTIONS_RUNNER_INPUT_["\'])';
  const entry = new RegExp(
    `foreach\\s*\\(\\s*DictionaryEntry\\s+(${identifier})\\s+in\\s+Environment\\s*\\.\\s*GetEnvironmentVariables\\(\\s*\\)\\s*\\)`
  ).exec(source)?.[1];
  const key = entry
    ? new RegExp(
        `\\b(?:var|string)\\s+(${identifier})\\s*=\\s*${entry}\\s*\\.\\s*Key\\s+as\\s+string(?:\\s*\\?\\?\\s*string\\s*\\.\\s*Empty)?\\s*;`
      ).exec(source)?.[1]
    : undefined;
  const value = entry
    ? new RegExp(
        `\\b(?:var|string)\\s+(${identifier})\\s*=\\s*${entry}\\s*\\.\\s*Value\\s+as\\s+string(?:\\s*\\?\\?\\s*string\\s*\\.\\s*Empty)?\\s*;`
      ).exec(source)?.[1]
    : undefined;
  if (
    !entry ||
    !key ||
    !value ||
    !new RegExp(
      `${key}\\s*\\.\\s*StartsWith\\(\\s*${prefix}\\s*,\\s*StringComparison\\s*\\.\\s*OrdinalIgnoreCase\\s*\\)`
    ).test(source)
  )
    fail('semantics input loop');
  const mask = new RegExp(
    `\\b_?[Ss]ecret[Mm]asker\\s*\\.\\s*(${identifier})\\s*\\(\\s*(${identifier})\\s*\\)`
  ).exec(source);
  if (mask?.[1].toLowerCase() !== 'addvalue' || mask[2] !== value)
    fail('semantics mask');
  const argument = new RegExp(
    `\\b_args\\s*\\[\\s*${key}\\s*\\.\\s*Substring\\(\\s*${prefix}\\s*\\.\\s*Length\\s*\\)\\s*\\]\\s*=\\s*(${identifier})\\s*;`
  ).exec(source);
  if (argument?.[1] !== value) fail('semantics argument copy');
  if (
    !new RegExp(
      `Environment\\s*\\.\\s*SetEnvironmentVariable\\(\\s*${key}\\s*,\\s*null\\s*\\)`
    ).test(source)
  )
    fail('semantics environment removal');
  const receipt = {
    commandSettingsSha256: sourceSha256,
    commandSettingsUrl: sourceUrl,
    nodeProcessExecve: true,
    runnerSha256: runnerArchiveSha256,
    runnerVersion,
    schemaVersion: 1,
    secretInputContract: {
      copiedToArgumentMap: true,
      masked: true,
      removedFromEnvironment: true,
    },
  };
  assertReceiptShape(receipt);
  return receipt;
}
