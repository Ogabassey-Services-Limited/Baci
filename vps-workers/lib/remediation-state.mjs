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
const NOTIFICATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
const DEFAULT_RESERVATION_TTL_MS = 15 * 60 * 1_000;
const DEFAULT_RETRY_DELAY_MS = 6 * 60 * 60 * 1_000;
const STALE_LOCK_MS = 2 * 60 * 1_000;

const observationFor = (candidate) =>
  String(candidate.lastSeen || candidate.occurrences || 'observed');

function fallbackMarkerPath(path, candidate) {
  const key = Buffer.from(String(candidate.fingerprint || 'unknown'))
    .toString('hex')
    .slice(0, 160);
  return `${path}.handled-fallback/${key}.json`;
}

function readFallbackObservation(path, candidate) {
  try {
    const marker = JSON.parse(
      readFileSync(fallbackMarkerPath(path, candidate), 'utf8')
    );
    return typeof marker?.observation === 'string' ? marker.observation : null;
  } catch {
    return null;
  }
}

function persistFallbackObservation(path, candidate, recordedAt) {
  const markerPath = fallbackMarkerPath(path, candidate);
  mkdirSync(dirname(markerPath), { recursive: true });
  const temporaryPath = `${markerPath}.${process.pid}.tmp`;
  writeFileSync(
    temporaryPath,
    `${JSON.stringify({ observation: observationFor(candidate), recordedAt })}\n`,
    { mode: 0o600 }
  );
  renameSync(temporaryPath, markerPath);
}

function clearFallbackObservation(path, candidate) {
  try {
    unlinkSync(fallbackMarkerPath(path, candidate));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function reconcileFallbackObservations(path, state, candidates, recordedAt) {
  for (const candidate of candidates) {
    const observation = readFallbackObservation(path, candidate);
    if (!observation) continue;
    state.handled[candidate.fingerprint] = { observation, recordedAt };
    delete state.reservations[candidate.fingerprint];
    clearFallbackObservation(path, candidate);
  }
}

function capHandledEntries(handled) {
  return Object.fromEntries(
    Object.entries(handled)
      .sort(([, left], [, right]) =>
        right.recordedAt.localeCompare(left.recordedAt)
      )
      .slice(0, MAX_ENTRIES)
  );
}

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
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
}) {
  return {
    pending(candidates, { limit = Number.POSITIVE_INFINITY } = {}) {
      const nowMs = now();
      return withStateLock(path, nowMs, [], (state) => {
        const recordedAt = new Date(nowMs).toISOString();
        reconcileFallbackObservations(path, state, candidates, recordedAt);
        state.handled = capHandledEntries(state.handled);
        for (const [fingerprint, reservation] of Object.entries(
          state.reservations
        )) {
          if (Date.parse(reservation.expiresAt) <= nowMs) {
            delete state.reservations[fingerprint];
          }
        }
        const selected = [];
        for (const candidate of candidates) {
          if (selected.length >= limit) break;
          const observation = observationFor(candidate);
          if (
            state.handled[candidate.fingerprint]?.observation !== observation &&
            state.reservations[candidate.fingerprint]?.observation !==
              observation
          ) {
            selected.push(candidate);
          }
        }
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
    complete({
      deferCandidates = [],
      handledCandidates = [],
      notification,
      releaseCandidates = [],
    }) {
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
        const retryAt = new Date(nowMs + retryDelayMs).toISOString();
        for (const candidate of deferCandidates) {
          state.reservations[candidate.fingerprint] = {
            expiresAt: retryAt,
            observation: observationFor(candidate),
            recordedAt,
          };
        }
        state.handled = capHandledEntries(state.handled);
        if (notification) {
          state.notifications[notification.id] = {
            recordedAt,
            report: notification.report,
          };
        }
        const notificationCutoff = nowMs - NOTIFICATION_RETENTION_MS;
        state.notifications = Object.fromEntries(
          Object.entries(state.notifications)
            .filter(
              ([, entry]) => Date.parse(entry.recordedAt) >= notificationCutoff
            )
            .sort(([, left], [, right]) =>
              right.recordedAt.localeCompare(left.recordedAt)
            )
            .slice(0, MAX_ENTRIES)
        );
        persistState(path, state);
        for (const candidate of handledCandidates) {
          clearFallbackObservation(path, candidate);
        }
        return true;
      });
    },
    recordHandledFallback(candidates) {
      const recordedAt = new Date(now()).toISOString();
      for (const candidate of candidates) {
        persistFallbackObservation(path, candidate, recordedAt);
      }
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
