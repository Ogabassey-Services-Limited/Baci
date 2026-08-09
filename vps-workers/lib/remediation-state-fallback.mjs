import { createHash } from 'node:crypto';
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import {
  remediationObservationFor,
  remediationStateKeyFor,
} from './remediation-state-key.mjs';

const RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

export function createRemediationFallbackStore(path) {
  const markerDirectory = `${path}.handled-fallback`;
  const markerPath = (candidate) => {
    const key = createHash('sha256')
      .update(remediationStateKeyFor(candidate))
      .digest('hex');
    return `${markerDirectory}/${key}.json`;
  };
  const prune = (recordedAt) => {
    let files;
    try {
      files = readdirSync(markerDirectory);
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
    const cutoff = Date.parse(recordedAt) - RETENTION_MS;
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const marker = JSON.parse(
          readFileSync(`${markerDirectory}/${file}`, 'utf8')
        );
        if (Date.parse(marker?.recordedAt) < cutoff) {
          unlinkSync(`${markerDirectory}/${file}`);
        }
      } catch {
        // Preserve unreadable markers for explicit candidate reconciliation.
      }
    }
  };
  return {
    clear(candidate) {
      try {
        unlinkSync(markerPath(candidate));
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    },
    persist(candidate, recordedAt) {
      const target = markerPath(candidate);
      mkdirSync(dirname(target), { recursive: true });
      const temporaryPath = `${target}.${process.pid}.tmp`;
      writeFileSync(
        temporaryPath,
        `${JSON.stringify({
          observation: remediationObservationFor(candidate),
          recordedAt,
        })}\n`,
        { mode: 0o600 }
      );
      renameSync(temporaryPath, target);
    },
    reconcile(state, candidates, recordedAt) {
      prune(recordedAt);
      const reconciled = [];
      for (const candidate of candidates) {
        let content;
        try {
          content = readFileSync(markerPath(candidate), 'utf8');
        } catch (error) {
          if (error?.code === 'ENOENT') continue;
          throw error;
        }
        const observation = JSON.parse(content)?.observation;
        if (typeof observation !== 'string') continue;
        const key = remediationStateKeyFor(candidate);
        state.handled[key] = { observation, recordedAt };
        delete state.reservations[key];
        reconciled.push(candidate);
      }
      return reconciled;
    },
  };
}
