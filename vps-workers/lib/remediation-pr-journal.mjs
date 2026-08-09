import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';

const MAX_ENTRIES = 100;
const MAX_LENGTH = 500;
const ENTRY_KEYS = [
  'at',
  'branch',
  'caseKey',
  'fingerprint',
  'observation',
  'prUrl',
  'type',
];
const safe = (value, length = MAX_LENGTH) =>
  String(value || '')
    .replace(/[^A-Za-z0-9:/_.-]/g, '')
    .slice(0, length);

function read(path) {
  let content;
  try {
    content = readFileSync(path, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw new Error(`Unable to read remediation PR journal at ${path}`, {
      cause: error,
    });
  }
  let entries;
  try {
    entries = JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid remediation PR journal JSON at ${path}`, {
      cause: error,
    });
  }
  if (!Array.isArray(entries) || !entries.every(validEntry)) {
    throw new Error(`Invalid remediation PR journal schema at ${path}`);
  }
  return entries.slice(-MAX_ENTRIES);
}

function validEntry(entry) {
  return (
    entry &&
    typeof entry === 'object' &&
    !Array.isArray(entry) &&
    Object.keys(entry).length === ENTRY_KEYS.length &&
    Object.keys(entry).every((key) => ENTRY_KEYS.includes(key)) &&
    entry.type === 'pr_opened' &&
    isIsoTimestamp(entry.at) &&
    validSafeString(entry.branch) &&
    validSafeString(entry.caseKey, 300) &&
    validSafeString(entry.fingerprint, 120) &&
    entry.caseKey.endsWith(`:${entry.fingerprint}`) &&
    validSafeString(entry.observation, 120) &&
    validSafeString(entry.prUrl)
  );
}

function isIsoTimestamp(value) {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function validSafeString(value, length = MAX_LENGTH) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= length &&
    safe(value, length) === value
  );
}

function persist(path, entries) {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(entries, null, 2)}\n`, {
    mode: 0o600,
  });
  renameSync(temporaryPath, path);
}

function withLock(path, action) {
  const lockPath = `${path}.lock`;
  mkdirSync(dirname(path), { recursive: true });
  let descriptor;
  try {
    descriptor = openSync(lockPath, 'wx', 0o600);
    return action();
  } catch (error) {
    if (error?.code === 'EEXIST') {
      throw new Error(`remediation PR journal is busy at ${path}`, {
        cause: error,
      });
    }
    throw error;
  } finally {
    if (descriptor !== undefined) {
      closeSync(descriptor);
      unlinkSync(lockPath);
    }
  }
}

export function createRemediationPrJournal({ now = () => Date.now(), path }) {
  return {
    entries: () => read(path),
    record({ candidate, result }) {
      const entry = {
        at: new Date(now()).toISOString(),
        branch: safe(result?.branch),
        caseKey: safe(candidate?.caseKey, 300),
        fingerprint: safe(candidate?.fingerprint, 120),
        observation: safe(
          candidate?.observationMarker || candidate?.lastSeen,
          120
        ),
        prUrl: safe(result?.prUrl || result?.pullRequestUrl),
        type: 'pr_opened',
      };
      if (
        !validEntry(entry) ||
        !entry.caseKey ||
        !entry.fingerprint ||
        !entry.observation
      ) {
        throw new Error('Invalid remediation PR journal entry');
      }
      withLock(path, () =>
        persist(path, [
          ...read(path).filter((item) => item.caseKey !== entry.caseKey),
          entry,
        ])
      );
      return entry;
    },
    clear(caseKey) {
      withLock(path, () =>
        persist(
          path,
          read(path).filter((entry) => entry.caseKey !== caseKey)
        )
      );
    },
  };
}
