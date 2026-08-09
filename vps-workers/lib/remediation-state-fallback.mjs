import { createHash } from 'node:crypto';
import {
  mkdirSync,
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

export function createRemediationFallbackStore(path) {
  const markerPath = (candidate) => {
    const key = createHash('sha256')
      .update(remediationStateKeyFor(candidate))
      .digest('hex');
    return `${path}.handled-fallback/${key}.json`;
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
      const reconciled = [];
      for (const candidate of candidates) {
        let observation;
        try {
          observation = JSON.parse(
            readFileSync(markerPath(candidate), 'utf8')
          )?.observation;
        } catch {
          observation = null;
        }
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
