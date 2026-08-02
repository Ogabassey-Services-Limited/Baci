// biome-ignore-all format: compact primitives stay below the repository file limit
import { createHash } from 'node:crypto';

export const API = 'https://api.github.com';
export const ARTIFACT_MEMBER = 'h0-runner-attestation.json';
export const REPOSITORY = Object.freeze({ id: 1100488586, name: 'ogabasseyy/Baci' });
export const WORKFLOW_PATH = '.github/workflows/cwv-runner-attestation.yml';
export const hash = (value) => createHash('sha256').update(value).digest('hex');
export const fail = (message) => { throw new Error(message); };
export const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
export const exact = (value, keys) => {
  if (!object(value)) return false;
  const actual = Object.keys(value); const expected = [...keys];
  return actual.length === expected.length && actual.sort().join(',') === expected.sort().join(',');
};

export function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (!object(value) || Object.getPrototypeOf(value) !== Object.prototype) fail('invalid state');
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

export function assertState(state) {
  if (!object(state) || !Number.isInteger(state.generation) || state.generation < 0 || typeof state.phase !== 'string' || typeof state.stateDigest !== 'string') fail('invalid state');
  const { stateDigest: _ignored, ...unsigned } = state;
  if (state.stateDigest !== hash(canonical(unsigned))) fail('invalid state');
}
