import { createHash as hash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';

// biome-ignore format: keeps the sealed state module below the source ceiling.
import { createRegistrationCaptureEvidence, deriveRegistrationCaptureAuthorityFromEvidence } from './campaign-capture-authority.mjs';
import { assertNoMarkCollision } from './campaign-state-collisions.mjs';
import { withJournalLock } from './campaign-state-journal-lock.mjs';

export { assertNoMarkCollision } from './campaign-state-collisions.mjs';
export { calculateTrafficDeltas } from './campaign-traffic.mjs';

const isClosedMode = (mode) =>
  /^(prepare|registration|campaign|rehearsal)$/.test(mode);
const isPhase = (phase) =>
  /^(acquiring|active|restoring|restored|target-accepted)$/.test(phase);
const SHA = /^[a-f0-9]{64}$/;
const SECRET_KEY =
  /(?:^|[_-]|(?<=[a-z]))(token|secret|password|credential|cookie|authorization|bearer|session)(?=$|[_-]|[A-Z])|(?:^|[_-]|(?<=[a-z]))(api|access|private)(?:[_-]|(?=[A-Z]))key(?=$|[_-]|[A-Z])/i;
const readText = (file) => fs.readFile(file, 'utf8');
function normalize(value, seen = new Set()) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string')
    return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object' || seen.has(value))
    throw new TypeError('unsupported JSON value');
  seen.add(value);
  const result = Array.isArray(value)
    ? value.map((item) => normalize(item, seen))
    : Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => {
            if (SECRET_KEY.test(key))
              throw new TypeError(`secret-shaped key: ${key}`);
            return [key, normalize(value[key], seen)];
          })
      );
  seen.delete(value);
  return result;
}
export const canonicalJson = (value) => JSON.stringify(normalize(value));
export const sha256 = (value) => hash('sha256').update(value).digest('hex');
function requireId(transactionId) {
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(transactionId))
    throw new TypeError('invalid transaction id');
}
function transactionDir(root, transactionId) {
  requireId(transactionId);
  return path.join(root, transactionId);
}
async function syncDirectory(directory) {
  const handle = await fs.open(directory, 'r');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function assertPrivateDirectory(directory) {
  const details = await fs.lstat(directory);
  if (
    !details.isDirectory() ||
    details.isSymbolicLink() ||
    details.uid !== process.getuid() ||
    (details.mode & 0o077) !== 0
  )
    throw new Error('secure campaign root required');
}
async function atomicWrite(file, bytes, mode = 0o600) {
  const temporary = `${file}.tmp-${process.pid}`;
  const handle = await fs.open(temporary, 'wx', mode);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(temporary, file);
  await syncDirectory(path.dirname(file));
}
// biome-ignore format: keeps the sealed state module below the source ceiling.
export async function createCapture(options) {
  const { root, transactionId, mode, host, priorState, registrationAuthority, registrationAuthorityEvidence, syncRoot } = options;
  requireId(transactionId);
  if (!isClosedMode(mode)) throw new TypeError('mode is not a closed mode');
  normalize(priorState);
  validatePriorState(priorState);
  if (mode !== 'registration' && (registrationAuthority !== undefined || registrationAuthorityEvidence !== undefined)) throw new TypeError('registration authority requires registration mode');
  if (mode === 'registration' && (registrationAuthority === undefined || registrationAuthorityEvidence === undefined)) {
    throw new TypeError('registration capture authority required');
  } else if (mode === 'registration') {
    try {
      const derived = deriveRegistrationCaptureAuthorityFromEvidence({ evidence: registrationAuthorityEvidence, externalInterface: priorState.network.externalInterface, inventoryDigests: priorState.network.inventories });
      if (canonicalJson(derived) !== canonicalJson(registrationAuthority)) throw new TypeError('mismatch');
    } catch {
      throw new TypeError('invalid registration authority');
    }
  }
  await assertPrivateDirectory(root);
  const capture = normalize({
    schemaVersion: 1,
    transactionId,
    mode,
    host,
    priorState,
    ...(mode === 'registration' ? { ...registrationAuthority, registrationAuthorityEvidence } : {}),
  });
  const directory = transactionDir(root, transactionId);
  await fs.mkdir(directory, { mode: 0o700, recursive: false });
  await syncDirectory(root);
  await syncRoot?.(root);
  await fs.mkdir(path.join(directory, 'journal'), { mode: 0o700 });
  await assertPrivateDirectory(directory);
  await assertPrivateDirectory(path.join(directory, 'journal'));
  const bytes = `${canonicalJson(capture)}\n`;
  const digest = sha256(bytes);
  const capturePath = path.join(directory, 'capture.json');
  const shaPath = path.join(directory, 'capture.sha256');
  await atomicWrite(capturePath, bytes);
  await atomicWrite(shaPath, `${digest}\n`);
  return { capturePath, shaPath, sha256: digest };
}
export async function verifyCapture(options) {
  const { root, transactionId, expectedSha256, host } = options;
  if (!SHA.test(expectedSha256)) throw new TypeError('invalid capture digest');
  const directory = transactionDir(root, transactionId);
  await assertPrivateDirectory(root);
  await assertPrivateDirectory(directory);
  const [bytes, recorded] = await Promise.all([
    readText(path.join(directory, 'capture.json')),
    readText(path.join(directory, 'capture.sha256')),
  ]);
  if (recorded !== `${expectedSha256}\n` || sha256(bytes) !== expectedSha256)
    throw new Error('capture digest mismatch');
  const capture = JSON.parse(bytes);
  if (`${canonicalJson(capture)}\n` !== bytes)
    throw new Error('capture is not canonical');
  if (capture.transactionId !== transactionId || !isClosedMode(capture.mode))
    throw new Error('capture identity mismatch');
  if (host && canonicalJson(capture.host) !== canonicalJson(host))
    throw new Error('host identity mismatch');
  return { ...capture, sha256: expectedSha256 };
}
export async function setPhase({ root, transactionId, phase }) {
  if (!isPhase(phase)) throw new TypeError('invalid phase');
  if (phase === 'target-accepted')
    throw new TypeError('target acceptance requires a verified target receipt');
  const file = path.join(transactionDir(root, transactionId), 'phase.json');
  await atomicWrite(file, `${canonicalJson({ phase })}\n`);
}
export async function recordJournalEntry(options) {
  const { root, transactionId, action, resource } = options;
  const expectedSha256 = (
    await readText(
      path.join(transactionDir(root, transactionId), 'capture.sha256')
    )
  ).trim();
  const capture = await verifyCapture({ root, transactionId, expectedSha256 });
  const directory = path.join(transactionDir(root, transactionId), 'journal');
  return withJournalLock(directory, async () => {
    const names = (await fs.readdir(directory))
      .filter((name) => /^\d{6}-[a-f0-9]{64}\.json$/.test(name))
      .sort();
    const sequence = names.length + 1;
    const previousSha256 = names.length > 0 ? names.at(-1).slice(7, 71) : null;
    const entry = normalize({
      schemaVersion: 1,
      transactionId,
      captureSha256: capture.sha256,
      mode: capture.mode,
      sequence,
      previousSha256,
      action,
      resource,
      resourceIdentitySha256: sha256(canonicalJson(resource)),
    });
    const bytes = `${canonicalJson(entry)}\n`;
    const digest = sha256(bytes);
    const filename = `${String(sequence).padStart(6, '0')}-${digest}.json`;
    const handle = await fs.open(path.join(directory, filename), 'wx', 0o600);
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await syncDirectory(directory);
    return { ...entry, sha256: digest };
  });
}
export async function inspectProgress({ root, transactionId }) {
  const directory = transactionDir(root, transactionId);
  const expectedSha256 = (
    await readText(path.join(directory, 'capture.sha256'))
  ).trim();
  const capture = await verifyCapture({ root, transactionId, expectedSha256 });
  const anomalies = [];
  let phase = null;
  try {
    const phaseBytes = await readText(path.join(directory, 'phase.json'));
    const parsed = JSON.parse(phaseBytes);
    if (`${canonicalJson(parsed)}\n` !== phaseBytes || !isPhase(parsed.phase))
      throw new Error('invalid');
    phase = parsed.phase;
  } catch {
    anomalies.push('phase-invalid-or-missing');
  }
  let previous = null;
  const names = (await fs.readdir(path.join(directory, 'journal'))).sort();
  let expectedSequence = 1;
  for (const name of names) {
    const match = /^(\d{6})-([a-f0-9]{64})\.json$/.exec(name);
    if (!match) {
      anomalies.push(`journal-unexpected:${name}`);
      continue;
    }
    try {
      const bytes = await readText(path.join(directory, 'journal', name));
      const entry = JSON.parse(bytes);
      if (
        Number(match[1]) !== expectedSequence ||
        entry.sequence !== expectedSequence ||
        entry.schemaVersion !== 1 ||
        entry.transactionId !== transactionId ||
        entry.captureSha256 !== capture.sha256 ||
        entry.mode !== capture.mode ||
        entry.resourceIdentitySha256 !==
          sha256(canonicalJson(entry.resource)) ||
        match[2] !== sha256(bytes) ||
        entry.previousSha256 !== previous ||
        `${canonicalJson(entry)}\n` !== bytes
      )
        throw new Error('invalid');
      previous = sha256(bytes);
      expectedSequence += 1;
    } catch {
      anomalies.push(
        Number(match[1]) !== expectedSequence
          ? `journal-sequence:${name}`
          : `journal-invalid:${name}`
      );
    }
  }
  return { anomalies, phase };
}
const requiredInventory =
  'nftables iptables ip6tables ipRules4 ipRules6 tc conntrack addresses routes dockerNetworks'.split(
    ' '
  );
const isText = (value) => typeof value === 'string' && value.length > 0;
const hasFields = (row, texts, booleans) =>
  isText(row.id) &&
  texts.every((key) => isText(row[key])) &&
  booleans.every((key) => typeof row[key] === 'boolean');
const resourceShapes = {
  runners: (row) => hasFields(row, ['runnerRoot'], ['active']),
  timers: (row) => hasFields(row, [], ['active', 'enabled']),
  containers: (row) => hasFields(row, ['cpuset', 'role'], ['running']),
  slices: (row) => hasFields(row, ['allowedCpus'], []),
};
// biome-ignore format: keeps the sealed state module below the source ceiling.
export function validatePriorState(prior) {
  const resources = prior?.resources;
  const network = prior?.network;
  if (prior?.schemaVersion !== 1 || !Object.entries(resourceShapes).every(([key, valid]) => Array.isArray(resources?.[key]) && resources[key].every(valid)) || !SHA.test(prior?.cron?.sha256) || !SHA.test(prior?.cron?.archiveSha256) || !isText(prior?.cron?.archivePath) || typeof prior?.cron?.serviceActive !== 'boolean' || typeof prior?.cron?.serviceEnabled !== 'boolean' || network?.ipForward !== 1 || network?.accountingTablePresent !== false || !SHA.test(network?.baselineSha256) || !isText(network?.externalInterface?.name) || !Number.isInteger(network?.externalInterface?.ifindex) || !requiredInventory.every((key) => SHA.test(network?.inventories?.[key])))
    throw new Error('complete prior state required');
  assertNoMarkCollision(network.campaignMark, network.collisions);
}
// biome-ignore format: keeps the sealed state module below the source ceiling.
async function main(argv) {
  const [command, root, transactionId, value, extra] = argv;
  const state = { root, transactionId };
  if (command === 'create-capture') {
    const [mode, hostPath, priorPath, authorityPath, addressesPath, dockerNetworksPath, servicesPath] = [value, extra, argv[5], argv[6], argv[7], argv[8], argv[9]];
    if ((mode === 'registration') !== Boolean(authorityPath && addressesPath && dockerNetworksPath && servicesPath))
      throw new TypeError('registration capture authority required');
    const host = JSON.parse(await readText(hostPath));
    const priorState = JSON.parse(await readText(priorPath));
    const registrationAuthority = authorityPath ? JSON.parse(await readText(authorityPath)) : undefined;
    const registrationAuthorityEvidence = authorityPath ? createRegistrationCaptureEvidence({ addresses: await fs.readFile(addressesPath), dockerNetworks: await fs.readFile(dockerNetworksPath), services: JSON.parse(await readText(servicesPath)) }) : undefined;
    const result = await createCapture({ ...state, mode, host, priorState, registrationAuthority, registrationAuthorityEvidence });
    process.stdout.write(`${result.sha256}\n`);
  } else if (command === 'verify-capture') {
    const capture = await verifyCapture({ ...state, expectedSha256: value });
    process.stdout.write(`${capture.mode}\n`);
  } else if (command === 'phase') return setPhase({ ...state, phase: value });
  else if (command === 'journal')
    return recordJournalEntry({ ...state, action: value, resource: extra });
  else throw new Error('unsupported campaign-state command');
}
if (import.meta.filename === process.argv[1]) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
