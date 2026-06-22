import { expect } from 'vitest';

type UpsertRecord = {
  payload: Record<string, unknown> | Record<string, unknown>[];
};

export function expectHomogeneousPayloadKeys(
  payload: Record<string, unknown> | Record<string, unknown>[]
) {
  const rows = Array.isArray(payload) ? payload : [payload];
  const keySets = rows.map((row) => Object.keys(row).sort().join('\0'));
  expect(new Set(keySets)).toHaveLength(1);
}

export function getUpsertPayloadRows(
  upserts: readonly UpsertRecord[]
): Record<string, unknown>[] {
  const payload = upserts[0]?.payload;
  expect(Array.isArray(payload)).toBe(true);
  return payload as Record<string, unknown>[];
}
