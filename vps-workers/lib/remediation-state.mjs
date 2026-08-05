import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';

const MAX_ENTRIES = 2_000;
const DEFAULT_RESERVATION_TTL_MS = 15 * 60 * 1_000;
const STALE_LOCK_MS = 2 * 60 * 1_000;

const observationFor = (candidate) =>
  String(candidate.lastSeen || candidate.occurrences || 'observed');

const isIsoDate = (value) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));

function normalizeObservedEntries(value, timeField) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      ([fingerprint, entry]) =>
        fingerprint &&
        entry &&
        typeof entry === 'object' &&
        !Array.isArray(entry) &&
        typeof entry.observation === 'string' &&
        isIsoDate(entry[timeField])
    )
  );
}

function normalizeNotifications(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      const report = entry?.report;
      return (
        entry &&
        typeof entry === 'object' &&
        isIsoDate(entry.recordedAt) &&
        report &&
        typeof report.html === 'string' &&
        typeof report.subject === 'string' &&
        typeof report.text === 'string'
      );
    })
  );
}

function readState(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    if (parsed?.version !== 1 && parsed?.version !== 2) {
      return { handled: {}, notifications: {}, reservations: {} };
    }
    return {
      handled: normalizeObservedEntries(parsed.handled, 'recordedAt'),
      notifications: normalizeNotifications(parsed.notifications),
      reservations: normalizeObservedEntries(parsed.reservations, 'expiresAt'),
    };
  } catch {
    return { handled: {}, notifications: {}, reservations: {} };
  }
}

function persistState(path, state) {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  writeFileSync(
    temporaryPath,
    `${JSON.stringify({ ...state, version: 2 }, null, 2)}\n`,
    { mode: 0o600 }
  );
  renameSync(temporaryPath, path);
}

function acquireLock(path, nowMs) {
  const lockPath = `${path}.lock`;
  mkdirSync(dirname(path), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return { descriptor: openSync(lockPath, 'wx', 0o600), lockPath };
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      const modifiedAt = statSync(lockPath, { throwIfNoEntry: false })?.mtimeMs;
      if (attempt === 0 && modifiedAt && nowMs - modifiedAt > STALE_LOCK_MS) {
        unlinkSync(lockPath);
        continue;
      }
      return null;
    }
  }
  return null;
}

function withStateLock(path, nowMs, fallback, action) {
  const lock = acquireLock(path, nowMs);
  if (!lock) return fallback;
  try {
    return action(readState(path));
  } finally {
    closeSync(lock.descriptor);
    unlinkSync(lock.lockPath);
  }
}

export function createRemediationState({
  now = () => Date.now(),
  path,
  reservationTtlMs = DEFAULT_RESERVATION_TTL_MS,
}) {
  return {
    pending(candidates) {
      const nowMs = now();
      return withStateLock(path, nowMs, [], (state) => {
        for (const [fingerprint, reservation] of Object.entries(
          state.reservations
        )) {
          if (Date.parse(reservation.expiresAt) <= nowMs) {
            delete state.reservations[fingerprint];
          }
        }
        const selected = candidates.filter((candidate) => {
          const observation = observationFor(candidate);
          return (
            state.handled[candidate.fingerprint]?.observation !== observation &&
            state.reservations[candidate.fingerprint]?.observation !==
              observation
          );
        });
        const recordedAt = new Date(nowMs).toISOString();
        const expiresAt = new Date(nowMs + reservationTtlMs).toISOString();
        for (const candidate of selected) {
          state.reservations[candidate.fingerprint] = {
            expiresAt,
            observation: observationFor(candidate),
            recordedAt,
          };
        }
        persistState(path, state);
        return selected;
      });
    },
    complete({ handledCandidates = [], notification, releaseCandidates = [] }) {
      const nowMs = now();
      return withStateLock(path, nowMs, false, (state) => {
        const recordedAt = new Date(nowMs).toISOString();
        for (const candidate of handledCandidates) {
          state.handled[candidate.fingerprint] = {
            observation: observationFor(candidate),
            recordedAt,
          };
          delete state.reservations[candidate.fingerprint];
        }
        for (const candidate of releaseCandidates) {
          delete state.reservations[candidate.fingerprint];
        }
        state.handled = Object.fromEntries(
          Object.entries(state.handled)
            .sort(([, left], [, right]) =>
              right.recordedAt.localeCompare(left.recordedAt)
            )
            .slice(0, MAX_ENTRIES)
        );
        if (notification) {
          state.notifications[notification.id] = {
            recordedAt,
            report: notification.report,
          };
        }
        persistState(path, state);
        return true;
      });
    },
    mark(candidates) {
      return this.complete({ handledCandidates: candidates });
    },
    notifications() {
      return Object.entries(readState(path).notifications).map(
        ([id, entry]) => ({ id, report: entry.report })
      );
    },
    acknowledgeNotification(id) {
      const nowMs = now();
      return withStateLock(path, nowMs, false, (state) => {
        if (!state.notifications[id]) return true;
        delete state.notifications[id];
        persistState(path, state);
        return true;
      });
    },
  };
}
